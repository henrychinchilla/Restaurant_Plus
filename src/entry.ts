// src/entry.ts

export interface Env {
  DB: D1Database;
  EMAIL: {
    send: (msg: {
      to: string;
      from: { email: string; name: string };
      subject: string;
      html: string;
      text: string;
    }) => Promise<any>;
  };
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Cors headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Router for API endpoints
    if (url.pathname.startsWith('/api/')) {
      try {
        const response = await handleAPI(request, env, url);
        // Add cors headers
        const newResponse = new Response(response.body, response);
        for (const [key, value] of Object.entries(corsHeaders)) {
          newResponse.headers.set(key, value);
        }
        return newResponse;
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Default: serve static assets
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(env));
  }
};

async function handleAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const method = request.method;

  // 1. GET /api/config (Public)
  if (method === 'GET' && url.pathname === '/api/config') {
    const loyaltyStrategy = await getConfig(env.DB, 'loyalty_strategy', 'none');
    const discountVal = await getConfig(env.DB, 'loyalty_discount_value', '10% de descuento');
    const pointsVal = await getConfig(env.DB, 'loyalty_points_value', '50 puntos');
    const campaignStart = await getConfig(env.DB, 'campaign_start', '2026-06-01');
    const campaignEnd = await getConfig(env.DB, 'campaign_end', '2026-12-31');

    return Response.json({
      loyalty_strategy: loyaltyStrategy,
      loyalty_discount_value: discountVal,
      loyalty_points_value: pointsVal,
      campaign_start: campaignStart,
      campaign_end: campaignEnd
    });
  }

  // 2a. GET /api/survey/validate-code (Public - checks a single-use receipt code)
  if (method === 'GET' && url.pathname === '/api/survey/validate-code') {
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) {
      return Response.json({ valid: false, error: 'Ingresa un código.' });
    }
    const row = await env.DB.prepare('SELECT used FROM survey_codes WHERE code = ?').bind(code).first() as { used: number } | null;
    if (!row) {
      return Response.json({ valid: false, error: 'Código no encontrado. Verifica que esté escrito correctamente.' });
    }
    if (row.used) {
      return Response.json({ valid: false, error: 'Este código ya fue utilizado en otra encuesta.' });
    }
    return Response.json({ valid: true });
  }

  // 2. POST /api/survey (Submit survey)
  if (method === 'POST' && url.pathname === '/api/survey') {
    const data = await request.json() as any;

    // Validate required loyalty fields
    if (!data.customer_name || !data.customer_phone || !data.customer_email) {
      return new Response(JSON.stringify({ error: 'Name, phone and email are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const surveyCode = (data.survey_code || '').trim().toUpperCase();
    if (!surveyCode) {
      return new Response(JSON.stringify({ error: 'Falta el código de tu recibo.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Rate limit: block repeat submissions from the same phone or IP within a configurable window
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitHours = parseInt(await getConfig(env.DB, 'rate_limit_hours', '12'), 10) || 12;
    const recentRow = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM responses WHERE (customer_phone = ? OR ip_address = ?) AND created_at >= datetime('now', '-' || ? || ' hours')`
    ).bind(data.customer_phone, clientIp, rateLimitHours).first() as { count: number };
    if (recentRow && recentRow.count > 0) {
      return new Response(JSON.stringify({ error: 'Ya registramos una encuesta reciente con estos datos. Por favor espera antes de enviar otra.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Atomically claim the single-use receipt code (fails if missing or already used)
    const claim = await env.DB.prepare('UPDATE survey_codes SET used = 1, used_at = CURRENT_TIMESTAMP WHERE code = ? AND used = 0')
      .bind(surveyCode).run();
    if (!claim.meta || claim.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Código de recibo inválido o ya utilizado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Statistical fraud flags (logged for admin review, do not block submission)
    const flags: string[] = [];
    const isPerfectScore = data.food_rating === 10 && data.quality_rating === 10 && data.cost_rating === 10 &&
      data.atmosphere_rating === 10 && data.waiter_rating === 5 && data.parking_rating === 5;
    if (isPerfectScore) flags.push('calificacion_perfecta');

    const phoneHistory = await env.DB.prepare('SELECT COUNT(*) as count FROM responses WHERE customer_phone = ?')
      .bind(data.customer_phone).first() as { count: number };
    if (phoneHistory && phoneHistory.count > 0) flags.push('telefono_repetido');

    const flagReason = flags.length > 0 ? flags.join(',') : null;

    // Get active configurations for rewards
    const loyaltyStrategy = await getConfig(env.DB, 'loyalty_strategy', 'none');
    const discountVal = await getConfig(env.DB, 'loyalty_discount_value', '10%');
    const pointsVal = await getConfig(env.DB, 'loyalty_points_value', '50');
    
    let rewardSent = 'none';
    let rewardDetails = '';

    if (loyaltyStrategy === 'discount') {
      rewardSent = 'discount';
      rewardDetails = discountVal;
    } else if (loyaltyStrategy === 'points') {
      rewardSent = 'points';
      rewardDetails = pointsVal;
    }

    // Save response in D1
    const query = `
      INSERT INTO responses (
        customer_name, customer_phone, customer_email,
        food_rating, atmosphere_rating, waiter_rating, waiter_name,
        quality_rating, cost_rating, manager_greeted, manager_name,
        parking_rating, event_type, event_rating_song_selection,
        event_rating_wait_time, event_rating_general, comments,
        reward_sent, reward_details, survey_code, ip_address, flag_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await env.DB.prepare(query)
      .bind(
        data.customer_name,
        data.customer_phone,
        data.customer_email,
        data.food_rating || 0,
        data.atmosphere_rating || 0,
        data.waiter_rating || 0,
        data.waiter_name || null,
        data.quality_rating || 0,
        data.cost_rating || 0,
        data.manager_greeted ? 1 : 0,
        data.manager_name || null,
        data.parking_rating || 0,
        data.event_type || 'none',
        data.event_rating_song_selection || null,
        data.event_rating_wait_time || null,
        data.event_rating_general || null,
        data.comments || null,
        rewardSent,
        rewardDetails,
        surveyCode,
        clientIp,
        flagReason
      )
      .run();

    // Trigger confirmation email to customer
    let emailStatus = 'pending';
    try {
      const emailHost = new URL(request.url).hostname;
      const fromEmail = `encuestas@${emailHost.includes('localhost') || emailHost.includes('127.0.0.1') ? 'restaurantplus.com' : emailHost}`;
      
      let rewardSection = '';
      if (rewardSent === 'discount') {
        rewardSection = `
          <div style="background-color: #f3f4f6; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #065f46; margin-top: 0;">¡Felicidades! Has ganado un beneficio:</h3>
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #111827;">${rewardDetails}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;">Presenta este correo electrónico en tu próxima visita para hacerlo válido.</p>
          </div>
        `;
      } else if (rewardSent === 'points') {
        rewardSection = `
          <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #1e3a8a; margin-top: 0;">¡Gracias por participar! Has acumulado puntos:</h3>
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #111827;">+${rewardDetails}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;">Los puntos han sido asignados a tu número telefónico registrado (${data.customer_phone}).</p>
          </div>
        `;
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #c41230; text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; margin-top: 0;">Chili's</h2>
          <p>Hola <strong>${data.customer_name}</strong>,</p>
          <p>Queremos agradecerte sinceramente por tomarte el tiempo para completar nuestra encuesta de satisfacción sobre tu reciente visita.</p>
          <p>Tu opinión es extremadamente valiosa para nosotros y nos ayuda a mejorar continuamente la calidad de nuestros alimentos, el ambiente y el servicio que te ofrecemos.</p>
          
          ${rewardSection}

          <p>Ten por seguro que daremos seguimiento a todas tus observaciones para garantizar que cada visita tuya sea una experiencia excelente.</p>
          <p style="margin-top: 30px;">Atentamente,</p>
          <p style="font-weight: bold; color: #111827; margin: 0;">La Gerencia</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 5px;">Chili's - Calidad y Servicio</p>
        </div>
      `;

      const emailText = `
        Hola ${data.customer_name},
        
        Queremos agradecerte sinceramente por tomarte el tiempo para completar nuestra encuesta de satisfacción sobre tu reciente visita.
        Tu opinión es extremadamente valiosa para nosotros y nos ayuda a mejorar continuamente.
        
        ${rewardSent !== 'none' ? `Premio: ${rewardDetails}` : ''}
        
        Ten por seguro que daremos seguimiento a todas tus observaciones.
        
        Atentamente,
        La Gerencia - Chili's
      `;

      await env.EMAIL.send({
        to: data.customer_email,
        from: { email: fromEmail, name: "Chili's" },
        subject: "¡Gracias por tu opinión! - Chili's",
        html: emailHtml,
        text: emailText
      });
      emailStatus = 'sent';
    } catch (e: any) {
      console.error('Failed to send confirmation email:', e);
      emailStatus = `failed: ${e.message}`;
    }

    // Trigger manager notification (if enabled)
    const managerNotifs = await getConfig(env.DB, 'manager_notifications_enabled', 'false');
    if (managerNotifs === 'true') {
      try {
        const mgrEmail = await getConfig(env.DB, 'manager_email', '');
        if (mgrEmail) {
          const emailHost = new URL(request.url).hostname;
          const fromEmail = `alertas@${emailHost.includes('localhost') || emailHost.includes('127.0.0.1') ? 'restaurantplus.com' : emailHost}`;
          
          const alertHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #374151; border: 1px solid #f3f4f6; border-radius: 8px;">
              <h3 style="color: #b91c1c; border-bottom: 1px solid #f3f4f6; padding-bottom: 10px; margin-top: 0;">Nueva Encuesta de Cliente Recibida</h3>
              <p><strong>Cliente:</strong> ${data.customer_name}</p>
              <p><strong>Correo:</strong> ${data.customer_email}</p>
              <p><strong>Teléfono:</strong> ${data.customer_phone}</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr style="background-color: #f9fafb;"><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Alimentos (1-10)</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.food_rating}/10</td></tr>
                <tr><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Ambiente (1-10)</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.atmosphere_rating}/10</td></tr>
                <tr style="background-color: #f9fafb;"><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Calidad Productos (1-10)</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.quality_rating}/10</td></tr>
                <tr><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Costo Productos (1-10)</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.cost_rating}/10</td></tr>
                <tr style="background-color: #f9fafb;"><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Servicio Mesero (1-5)</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.waiter_rating}/5 (${data.waiter_name || 'N/A'})</td></tr>
                <tr><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Parqueo y Asistencia (1-5)</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.parking_rating}/5</td></tr>
                <tr style="background-color: #f9fafb;"><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Gerente Saludó?</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.manager_greeted ? 'Sí' : 'No'} (${data.manager_name || 'N/A'})</td></tr>
                <tr><td style="padding: 6px; border: 1px solid #e5e7eb;"><strong>Evento:</strong></td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.event_type || 'Ninguno'}</td></tr>
                ${data.event_type === 'karaoke' ? `
                  <tr style="background-color: #f9fafb;"><td style="padding: 6px; border: 1px solid #e5e7eb;">└ Petición Canción (1-5)</td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.event_rating_song_selection}/5</td></tr>
                  <tr><td style="padding: 6px; border: 1px solid #e5e7eb;">└ Tiempo de Espera (1-5)</td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.event_rating_wait_time}/5</td></tr>
                ` : data.event_type && data.event_type !== 'none' ? `
                  <tr style="background-color: #f9fafb;"><td style="padding: 6px; border: 1px solid #e5e7eb;">└ Calificación Evento (1-5)</td><td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center;">${data.event_rating_general}/5</td></tr>
                ` : ''}
              </table>
              <p><strong>Comentarios adicionales:</strong></p>
              <p style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-style: italic;">${data.comments || 'Sin comentarios.'}</p>
            </div>
          `;

          await env.EMAIL.send({
            to: mgrEmail,
            from: { email: fromEmail, name: "Sistema Alertas Chili's" },
            subject: `Alerta Encuesta: ${data.food_rating < 7 || data.waiter_rating < 3 ? '🔴 Puntuación Baja' : '🟢 Nueva Encuesta'} - ${data.customer_name}`,
            html: alertHtml,
            text: `Nueva encuesta recibida de ${data.customer_name}. Teléfono: ${data.customer_phone}. Calificaciones: Alimentos ${data.food_rating}/10, Servicio ${data.waiter_rating}/5. Comentario: ${data.comments || 'Ninguno'}.`
          });
        }
      } catch (e) {
        console.error('Failed to notify manager:', e);
      }
    }

    return Response.json({
      status: 'success',
      reward_sent: rewardSent,
      reward_details: rewardDetails,
      email_status: emailStatus
    });
  }

  // Admin Routes - Protect via Authorization Header (checks admin_password)
  const authHeader = request.headers.get('Authorization');
  const actualAdminPassword = await getConfig(env.DB, 'admin_password', 'restaurantplus2026');
  
  if (!authHeader || authHeader !== actualAdminPassword) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. POST /api/admin/login (Check auth success)
  if (method === 'POST' && url.pathname === '/api/admin/login') {
    return Response.json({ status: 'authenticated' });
  }

  // 4. GET /api/admin/stats (Compute KPIs)
  if (method === 'GET' && url.pathname === '/api/admin/stats') {
    const stats = await computeKPIs(env.DB);
    return Response.json(stats);
  }

  // 5. GET /api/admin/config (Get configurations)
  if (method === 'GET' && url.pathname === '/api/admin/config') {
    const loyaltyStrategy = await getConfig(env.DB, 'loyalty_strategy', 'none');
    const discountVal = await getConfig(env.DB, 'loyalty_discount_value', '');
    const pointsVal = await getConfig(env.DB, 'loyalty_points_value', '');
    const managerEmail = await getConfig(env.DB, 'manager_email', '');
    const managerPhone = await getConfig(env.DB, 'manager_phone', '');
    const managerNotifs = await getConfig(env.DB, 'manager_notifications_enabled', 'false');
    const adminPassword = await getConfig(env.DB, 'admin_password', 'restaurantplus2026');
    const campaignStart = await getConfig(env.DB, 'campaign_start', '2026-06-01');
    const campaignEnd = await getConfig(env.DB, 'campaign_end', '2026-12-31');
    const rateLimitHours = await getConfig(env.DB, 'rate_limit_hours', '12');

    return Response.json({
      loyalty_strategy: loyaltyStrategy,
      loyalty_discount_value: discountVal,
      loyalty_points_value: pointsVal,
      manager_email: managerEmail,
      manager_phone: managerPhone,
      manager_notifications_enabled: managerNotifs,
      admin_password: adminPassword,
      campaign_start: campaignStart,
      campaign_end: campaignEnd,
      rate_limit_hours: rateLimitHours
    });
  }

  // 6. POST /api/admin/config (Update configuration)
  if (method === 'POST' && url.pathname === '/api/admin/config') {
    const data = await request.json() as any;

    const updates = [];
    if (data.loyalty_strategy !== undefined) updates.push(setConfig(env.DB, 'loyalty_strategy', data.loyalty_strategy));
    if (data.loyalty_discount_value !== undefined) updates.push(setConfig(env.DB, 'loyalty_discount_value', data.loyalty_discount_value));
    if (data.loyalty_points_value !== undefined) updates.push(setConfig(env.DB, 'loyalty_points_value', data.loyalty_points_value));
    if (data.manager_email !== undefined) updates.push(setConfig(env.DB, 'manager_email', data.manager_email));
    if (data.manager_phone !== undefined) updates.push(setConfig(env.DB, 'manager_phone', data.manager_phone));
    if (data.manager_notifications_enabled !== undefined) updates.push(setConfig(env.DB, 'manager_notifications_enabled', data.manager_notifications_enabled));
    if (data.admin_password !== undefined) updates.push(setConfig(env.DB, 'admin_password', data.admin_password));
    if (data.campaign_start !== undefined) updates.push(setConfig(env.DB, 'campaign_start', data.campaign_start));
    if (data.campaign_end !== undefined) updates.push(setConfig(env.DB, 'campaign_end', data.campaign_end));
    if (data.rate_limit_hours !== undefined) updates.push(setConfig(env.DB, 'rate_limit_hours', data.rate_limit_hours));

    await Promise.all(updates);

    return Response.json({ status: 'success' });
  }

  // 6a. GET /api/admin/codes (List single-use survey codes)
  if (method === 'GET' && url.pathname === '/api/admin/codes') {
    const result = await env.DB.prepare('SELECT code, used, created_at, used_at FROM survey_codes ORDER BY created_at DESC LIMIT 500').all();
    return Response.json(result.results || []);
  }

  // 6b. POST /api/admin/codes/generate (Generate single-use survey codes)
  if (method === 'POST' && url.pathname === '/api/admin/codes/generate') {
    const data = await request.json() as any;
    const count = Math.min(Math.max(parseInt(data.count) || 1, 1), 200);

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(generateSurveyCode());
    }

    await env.DB.batch(
      codes.map(code => env.DB.prepare('INSERT OR IGNORE INTO survey_codes (code) VALUES (?)').bind(code))
    );

    return Response.json({ status: 'success', codes });
  }

  // 7. POST /api/admin/report (Send on-demand email report)
  if (method === 'POST' && url.pathname === '/api/admin/report') {
    const stats = await computeKPIs(env.DB);
    const mgrEmail = await getConfig(env.DB, 'manager_email', '');
    
    if (!mgrEmail) {
      return new Response(JSON.stringify({ error: 'Manager email not configured.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailHost = new URL(request.url).hostname;
    const fromEmail = `reportes@${emailHost.includes('localhost') || emailHost.includes('127.0.0.1') ? 'chilis-encuestas.com' : emailHost}`;
    
    const reportHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #c41230; text-align: center; margin-top: 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px;">Reporte de KPIs de Satisfacción</h2>
        <p>Hola,</p>
        <p>A continuación se detalla el reporte acumulado del estado de satisfacción del cliente para <strong>Chili's</strong>.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #111827;">Resumen General</h3>
          <p style="margin: 5px 0;"><strong>Total de Encuestas Recibidas:</strong> ${stats.total_responses}</p>
        </div>

        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px;">Métricas del Servicio (1 - 10)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Preparación Alimentos:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_food.toFixed(2)}/10</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Ambiente del Restaurante:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_atmosphere.toFixed(2)}/10</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Calidad de Productos:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_quality.toFixed(2)}/10</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Costo de Productos:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_cost.toFixed(2)}/10</td>
          </tr>
        </table>

        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px;">Atención y Staff (1 - 5)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Servicio y Atención Mesero:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_waiter.toFixed(2)}/5</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Parqueo y Asistencia:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_parking.toFixed(2)}/5</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Saludó de Gerente (% de visitas):</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${(stats.manager_greeted_percentage).toFixed(1)}%</td>
          </tr>
        </table>

        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px;">Métricas del Evento Karaoke (1 - 5)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Petición de Canción (Repertorio):</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_karaoke_song.toFixed(2)}/5</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Tiempos de Espera Karaoke:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">${stats.avg_karaoke_wait.toFixed(2)}/5</td>
          </tr>
        </table>

        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px;">Últimos Comentarios</h3>
        <div style="max-height: 200px; overflow-y: auto; font-size: 13px; color: #4b5563;">
          ${stats.recent_comments.length === 0 ? '<p>No hay comentarios.</p>' : stats.recent_comments.map((c: any) => `
            <div style="border-bottom: 1px solid #f3f4f6; padding: 8px 0;">
              <strong>${c.customer_name}</strong> (${c.created_at}):
              <p style="margin: 3px 0 0 0; font-style: italic;">"${c.comments}"</p>
            </div>
          `).join('')}
        </div>

        <p style="margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center;">Este es un reporte automático enviado por el sistema de encuestas de Chili's.</p>
      </div>
    `;

    await env.EMAIL.send({
      to: mgrEmail,
      from: { email: fromEmail, name: "Reportes Chili's" },
      subject: "Reporte de KPIs de Satisfacción - Chili's",
      html: reportHtml,
      text: `Reporte de KPIs para Chili's. Total de encuestas: ${stats.total_responses}. Alimentos: ${stats.avg_food.toFixed(2)}/10, Ambiente: ${stats.avg_atmosphere.toFixed(2)}/10, Meseros: ${stats.avg_waiter.toFixed(2)}/5. Ver detalle en el correo HTML.`
    });

    return Response.json({ status: 'success' });
  }

  return new Response('Not Found', { status: 404 });
}

// Helper functions for DB queries
async function getConfig(db: D1Database, key: string, defaultVal: string): Promise<string> {
  try {
    const result = await db.prepare('SELECT value FROM config WHERE key = ?').bind(key).first() as { value: string } | null;
    return result ? result.value : defaultVal;
  } catch (err) {
    console.error(`Error reading config key ${key}:`, err);
    return defaultVal;
  }
}

async function setConfig(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
    .bind(key, value)
    .run();
}

// Generates a single-use receipt code, avoiding visually ambiguous characters (0/O, 1/I/L)
function generateSurveyCode(): string {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += charset[bytes[i] % charset.length];
  }
  return code;
}

async function computeKPIs(db: D1Database): Promise<any> {
  const countRow = await db.prepare('SELECT COUNT(*) as total FROM responses').first() as { total: number };
  const total = countRow ? countRow.total : 0;

  if (total === 0) {
    return {
      total_responses: 0,
      avg_food: 0,
      avg_atmosphere: 0,
      avg_waiter: 0,
      avg_quality: 0,
      avg_cost: 0,
      avg_parking: 0,
      manager_greeted_percentage: 0,
      avg_karaoke_song: 0,
      avg_karaoke_wait: 0,
      flagged_count: 0,
      recent_comments: [],
      recent_responses: []
    };
  }

  const averages = await db.prepare(`
    SELECT
      AVG(food_rating) as avg_food,
      AVG(atmosphere_rating) as avg_atmosphere,
      AVG(waiter_rating) as avg_waiter,
      AVG(quality_rating) as avg_quality,
      AVG(cost_rating) as avg_cost,
      AVG(parking_rating) as avg_parking,
      AVG(CASE WHEN manager_greeted = 1 THEN 1.0 ELSE 0.0 END) * 100 as manager_greeted_percentage,
      AVG(CASE WHEN event_type = 'karaoke' AND event_rating_song_selection IS NOT NULL THEN event_rating_song_selection ELSE NULL END) as avg_karaoke_song,
      AVG(CASE WHEN event_type = 'karaoke' AND event_rating_wait_time IS NOT NULL THEN event_rating_wait_time ELSE NULL END) as avg_karaoke_wait
    FROM responses
  `).first() as any;

  const flaggedRow = await db.prepare(
    "SELECT COUNT(*) as count FROM responses WHERE flag_reason IS NOT NULL AND flag_reason != ''"
  ).first() as { count: number };

  const commentsQuery = await db.prepare(`
    SELECT customer_name, comments, created_at
    FROM responses
    WHERE comments IS NOT NULL AND comments != ''
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  const recentResponsesQuery = await db.prepare(`
    SELECT * FROM responses
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  return {
    total_responses: total,
    avg_food: averages.avg_food || 0,
    avg_atmosphere: averages.avg_atmosphere || 0,
    avg_waiter: averages.avg_waiter || 0,
    avg_quality: averages.avg_quality || 0,
    avg_cost: averages.avg_cost || 0,
    avg_parking: averages.avg_parking || 0,
    manager_greeted_percentage: averages.manager_greeted_percentage || 0,
    avg_karaoke_song: averages.avg_karaoke_song || 0,
    avg_karaoke_wait: averages.avg_karaoke_wait || 0,
    flagged_count: flaggedRow ? flaggedRow.count : 0,
    recent_comments: commentsQuery.results || [],
    recent_responses: recentResponsesQuery.results || []
  };
}

async function computeKPIsForDate(db: D1Database, dateStr: string): Promise<any> {
  const countRow = await db.prepare("SELECT COUNT(*) as total FROM responses WHERE date(created_at, '-6 hours') = ?").bind(dateStr).first() as { total: number };
  const total = countRow ? countRow.total : 0;

  if (total === 0) {
    return {
      total_responses: 0,
      avg_food: 0,
      avg_atmosphere: 0,
      avg_waiter: 0,
      avg_quality: 0,
      avg_cost: 0,
      avg_parking: 0,
      manager_greeted_percentage: 0,
      avg_karaoke_song: 0,
      avg_karaoke_wait: 0,
      recent_comments: []
    };
  }

  const averages = await db.prepare(`
    SELECT 
      AVG(food_rating) as avg_food,
      AVG(atmosphere_rating) as avg_atmosphere,
      AVG(waiter_rating) as avg_waiter,
      AVG(quality_rating) as avg_quality,
      AVG(cost_rating) as avg_cost,
      AVG(parking_rating) as avg_parking,
      AVG(CASE WHEN manager_greeted = 1 THEN 1.0 ELSE 0.0 END) * 100 as manager_greeted_percentage,
      AVG(CASE WHEN event_type = 'karaoke' AND event_rating_song_selection IS NOT NULL THEN event_rating_song_selection ELSE NULL END) as avg_karaoke_song,
      AVG(CASE WHEN event_type = 'karaoke' AND event_rating_wait_time IS NOT NULL THEN event_rating_wait_time ELSE NULL END) as avg_karaoke_wait
    FROM responses
    WHERE date(created_at, '-6 hours') = ?
  `).bind(dateStr).first() as any;

  const commentsQuery = await db.prepare(`
    SELECT customer_name, comments, created_at 
    FROM responses 
    WHERE date(created_at, '-6 hours') = ? AND comments IS NOT NULL AND comments != '' 
    ORDER BY created_at DESC
  `).bind(dateStr).all();

  return {
    total_responses: total,
    avg_food: averages.avg_food || 0,
    avg_atmosphere: averages.avg_atmosphere || 0,
    avg_waiter: averages.avg_waiter || 0,
    avg_quality: averages.avg_quality || 0,
    avg_cost: averages.avg_cost || 0,
    avg_parking: averages.avg_parking || 0,
    manager_greeted_percentage: averages.manager_greeted_percentage || 0,
    avg_karaoke_song: averages.avg_karaoke_song || 0,
    avg_karaoke_wait: averages.avg_karaoke_wait || 0,
    recent_comments: commentsQuery.results || []
  };
}

async function handleScheduled(env: Env): Promise<void> {
  const localTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const yesterday = new Date(localTime.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = yesterday.toISOString().split('T')[0];

  const mgrEmail = await getConfig(env.DB, 'manager_email', '');
  if (!mgrEmail) {
    console.log('Cron: No manager email configured. Exiting.');
    return;
  }

  const stats = await computeKPIsForDate(env.DB, dateStr);
  const fromEmail = `reportes-diarios@chilis-encuestas.com`;
  const subject = `Reporte Diario de Satisfacción - Chili's (${dateStr})`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #374151; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="text-align: center; border-bottom: 3px solid #c41230; padding-bottom: 15px; margin-bottom: 20px;">
        <h2 style="color: #c41230; margin: 0; font-size: 24px;">Chili's</h2>
        <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Reporte Diario de Satisfacción (${dateStr})</p>
      </div>
      
      <p>Hola,</p>
      <p>A continuación se presenta el resumen de las encuestas de satisfacción de los clientes registradas el día de ayer, <strong>${dateStr}</strong>.</p>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
        <h3 style="margin-top: 0; color: #111827; font-size: 16px;">Resumen de Participación</h3>
        <p style="margin: 5px 0; font-size: 15px;"><strong>Total de Encuestas Recibidas:</strong> ${stats.total_responses}</p>
      </div>

      \${stats.total_responses > 0 ? \`
        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; font-size: 16px;">Métricas del Servicio (1 - 10)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Preparación Alimentos:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right; color: \${stats.avg_food < 7 ? '#ef4444' : '#111827'};\u0060}>\${stats.avg_food.toFixed(2)}/10</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Ambiente del Restaurante:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">\${stats.avg_atmosphere.toFixed(2)}/10</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Calidad de Productos:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">\${stats.avg_quality.toFixed(2)}/10</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Costo de Productos:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">\${stats.avg_cost.toFixed(2)}/10</td>
          </tr>
        </table>

        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; font-size: 16px;">Atención y Staff (1 - 5)</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Servicio y Atención Mesero:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right; color: \${stats.avg_waiter < 3 ? '#ef4444' : '#111827'};\u0060}>\&nbsp;\${stats.avg_waiter.toFixed(2)}/5</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Parqueo y Asistencia:</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">\${stats.avg_parking.toFixed(2)}/5</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Saludó de Gerente (% de visitas):</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; text-align: right;">\${(stats.manager_greeted_percentage).toFixed(1)}%</td>
          </tr>
        </table>

        <h3 style="color: #c41230; border-bottom: 1px solid #f3f4f6; padding-bottom: 5px; font-size: 16px;">Comentarios de Clientes (\${stats.recent_comments.length})</h3>
        <div style="font-size: 13px; color: #4b5563;">
          \${stats.recent_comments.length === 0 ? '<p style="color: #9ca3af; font-style: italic;">No se registraron comentarios el día de ayer.</p>' : stats.recent_comments.map((c: any) => \`
            <div style="border-bottom: 1px solid #f3f4f6; padding: 10px 0;">
              <strong>\${c.customer_name}</strong>:
              <p style="margin: 3px 0 0 0; font-style: italic; color: #1f2937;">"\${c.comments}"</p>
            </div>
          \`).join('')}
        </div>
      \` : \`
        <p style="text-align: center; color: #9ca3af; font-style: italic; padding: 20px 0;">
          No se registraron encuestas de satisfacción el día de ayer.
        </p>
      \`}

      <p style="margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 15px;">
        Este es un reporte automático del sistema Chili's. Por favor no responder a este correo.
      </p>
    </div>
  `;

  const emailText = `
    Reporte Diario de Satisfacción - Chili's
    Fecha: ${dateStr}
    
    Total de encuestas recibidas: \${stats.total_responses}
    
    \${stats.total_responses > 0 ? \`
    Promedios (1-10):
    - Preparación Alimentos: \${stats.avg_food.toFixed(2)}/10
    - Ambiente: \${stats.avg_atmosphere.toFixed(2)}/10
    - Calidad: \${stats.avg_quality.toFixed(2)}/10
    - Costo: \${stats.avg_cost.toFixed(2)}/10
    
    Promedios (1-5):
    - Meseros: \${stats.avg_waiter.toFixed(2)}/5
    - Parqueo: \${stats.avg_parking.toFixed(2)}/5
    - Saludo Gerente: \${stats.manager_greeted_percentage.toFixed(1)}%
    \` : 'No se registraron encuestas ayer.'}
  `;

  try {
    await env.EMAIL.send({
      to: mgrEmail,
      from: { email: fromEmail, name: "Reportes Diarios Chili's" },
      subject: subject,
      html: emailHtml,
      text: emailText
    });
    console.log(`Daily stats email successfully sent to \${mgrEmail} for date \${dateStr}`);
  } catch (err: any) {
    console.error('Failed to send daily stats email:', err);
  }
}
