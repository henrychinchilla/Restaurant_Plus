# Restaurant Plus - Portal de Satisfacción del Cliente 🍽️✨

Este proyecto es una plataforma web completa y moderna diseñada para medir y diagnosticar la satisfacción del cliente de un restaurante (**Restaurant Plus**) en tiempo real, utilizando la infraestructura de **Cloudflare**. 

El sistema permite capturar la opinión detallada de los clientes en áreas clave, fidelizarlos mediante cupones o puntos automáticos y proveer un panel de control con métricas clave (KPIs) para la gerencia.

---

## 🚀 Tecnologías y Arquitectura

El proyecto está diseñado bajo una arquitectura serverless híbrida optimizada para el edge:
1. **Frontend**: Aplicación interactiva Single Page Application (SPA) construida con **React**, **TypeScript** y **Vite**.
2. **Estilos**: Sistema de diseño premium basado en **CSS puro** con estética restaurantera, animaciones suaves y soporte para temas claro/oscuro.
3. **Backend**: API serverless construida en **Cloudflare Workers**.
4. **Almacenamiento**: Base de datos SQL relacional **Cloudflare D1** (SQLite distribuido) para respuestas y variables de configuración.
5. **Comunicaciones**: **Cloudflare Email Sending** para el envío automático de confirmaciones transaccionales y notificaciones de alerta.
6. **Despliegue**: Unificado mediante **Workers Static Assets**, permitiendo servir el frontend de Vite y los endpoints del Worker desde un mismo subdominio.

---

## 🌟 Características Clave

* **Identificación del Cliente**: Solicita nombre, teléfono y correo electrónico para la fidelización segura del comensal.
* **Flujo de Encuesta por Pasos**:
  * **Alimentos y Ambiente**: Calificación numérica de 1 a 10 para preparación, calidad, costos y ambiente.
  * **Atención y Staff**: Calificación de 1 a 5 estrellas para el mesero (con nombre) y parqueo.
  * **Control de Gerencia**: Indica si el gerente se acercó a verificar y saludar (captura el nombre del gerente).
  * **Sección de Eventos**: Permite calificar actividades como la Noche de Karaoke (con KPIs específicos para repertorio musical y tiempo de espera).
* **Estrategia de Fidelización Administrable**:
  * Ofrece descuentos automáticos (ej. 10% de descuento) o puntos de lealtad (ej. 100 puntos) al finalizar.
  * Se puede activar, desactivar o modificar dinámicamente desde el panel administrativo.
* **Panel Administrativo Protegido (Dashboard)**:
  * Gráficas de barra y medidores de KPIs de satisfacción calculados en tiempo real.
  * Listado completo con buscador y detalles de las encuestas recopiladas.
  * Generador de **Código QR** dinámico listo para imprimir y descargar, permitiendo redireccionar a las mesas hacia la encuesta de satisfacción.
* **Notificaciones Inteligentes**:
  * Alertas en tiempo real por correo al encargado del área si se detectan bajas calificaciones (Alimentos < 7 o Mesero < 3).
  * Botón para enviar un reporte detallado en PDF/HTML acumulado de KPIs al responsable del restaurante.

---

## 🛠️ Configuración y Desarrollo Local

### Prerrequisitos
* Node.js v18+ y npm.
* Wrangler CLI instalado globalmente (`npm install -g wrangler`) o vía el proyecto.

### Instalación
1. Clona el repositorio e instala las dependencias:
   ```bash
   git clone https://github.com/henrychinchilla/Restaurant_Plus.git
   cd Restaurant_Plus
   npm install
   ```

2. Inicializar la Base de Datos D1 Localmente:
   ```bash
   npx wrangler d1 migrations apply restaurantplus_db --local
   ```

3. Cargar Datos de Prueba (Opcional):
   ```bash
   npx wrangler d1 execute restaurantplus_db --local --file=./mock_data.sql
   ```

4. Iniciar Servidor de Desarrollo Local:
   Construye la app e inicia el entorno de Wrangler local que sirve frontend y backend en conjunto:
   ```bash
   npm run build
   npx wrangler dev
   ```
   Abre [http://localhost:8787](http://localhost:8787) para ver la encuesta de satisfacción.
   Abre [http://localhost:8787/admin](http://localhost:8787/admin) para el panel de administración.

> [!NOTE]
> La contraseña de administrador por defecto es: **`restaurantplus2026`**

---

## 📦 Despliegue en Cloudflare

Para publicar el proyecto en producción en Cloudflare (bajo el nombre `restaurantplus`):

1. **Crear la Base de Datos D1 en Cloudflare**:
   ```bash
   npx wrangler d1 create restaurantplus_db
   ```
   Wrangler devolverá una salida parecida a esto:
   ```json
   [[d1_databases]]
   binding = "DB"
   database_name = "restaurantplus_db"
   database_id = "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   ```

2. **Configurar tu base de datos en `wrangler.jsonc`**:
   Copia el `database_id` retornado por Cloudflare y reemplázalo en el archivo `wrangler.jsonc` en la raíz del proyecto.

3. **Habilitar el Envío de Correos (Cloudflare Email Sending)**:
   Asegúrate de que tu dominio esté agregado a tu cuenta de Cloudflare y habilita la funcionalidad de Email Sending en el Dashboard o ejecuta:
   ```bash
   npx wrangler email sending enable tu-dominio.com
   ```

4. **Aplicar Migraciones en el Servidor de Producción**:
   ```bash
   npx wrangler d1 migrations apply restaurantplus_db --remote
   ```

5. **Construir y Desplegar el Proyecto**:
   ```bash
   npm run build
   npx wrangler deploy
   ```

El proyecto estará disponible en la URL asignada por Cloudflare (ej. `https://restaurantplus.<tu-subdominio>.workers.dev`).

---

## 📋 Estructura del Proyecto

```
restaurant_plus/
├── migrations/
│   └── 0001_schema.sql         # Esquema de base de datos D1 (DDL + Seeds)
├── src/
│   ├── assets/                 # Recursos e imágenes
│   ├── App.tsx                 # Frontend y Dashboard de la app (React)
│   ├── entry.ts                # Router y backend serverless (Cloudflare Worker)
│   ├── index.css               # Diseño general (Cream/Burgundy/Amber)
│   └── main.tsx                # Entrada de ejecución de React
├── index.html                  # Plantilla HTML con SEO optimizado
├── mock_data.sql               # Respuestas de prueba para poblar el Dashboard
├── wrangler.jsonc              # Configuraciones y bindings de Cloudflare
└── package.json                # Dependencias y scripts
```

---

## 🔑 Credenciales por Defecto (Entorno de Pruebas)
* **URL de la Encuesta**: `http://localhost:8787/`
* **URL de Administración**: `http://localhost:8787/admin`
* **Contraseña del Panel**: `restaurantplus2026`
* **Correo del Encargado por Defecto**: `henrychinchilla@gmail.com`
* **Teléfono del Encargado por Defecto**: `+50212345678`
