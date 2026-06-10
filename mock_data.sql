-- Seed mock responses
INSERT INTO responses (
  customer_name, customer_phone, customer_email,
  food_rating, atmosphere_rating, waiter_rating, waiter_name,
  quality_rating, cost_rating, manager_greeted, manager_name,
  parking_rating, event_type, event_rating_song_selection,
  event_rating_wait_time, event_rating_general, comments,
  reward_sent, reward_details, created_at
) VALUES 
('Ana Gómez', '+502 5543-9821', 'ana.gomez@mail.com', 9, 8, 5, 'Carlos', 9, 8, 1, 'Eduardo', 4, 'none', NULL, NULL, NULL, 'Excelente comida y servicio del mesero Carlos. Todo muy limpio.', 'discount', '10% de descuento en tu consumo final', '2026-06-10 11:20:00'),
('Roberto Martínez', '+502 4432-1190', 'roberto.mtz@mail.com', 8, 9, 4, 'María', 8, 7, 0, NULL, 5, 'karaoke', 4, 3, NULL, 'El ambiente estuvo fenomenal en la noche de karaoke. María nos atendió excelente. La comida tardó un poco.', 'discount', '10% de descuento en tu consumo final', '2026-06-10 12:15:00'),
('Sofía Castillo', '+502 3311-2244', 'sofia.castillo@mail.com', 6, 7, 3, 'Carlos', 7, 5, 1, 'Eduardo', 3, 'karaoke', 5, 2, NULL, 'Los precios están algo elevados para la porción de los platillos. El karaoke estuvo divertido y con buen repertorio.', 'discount', '10% de descuento en tu consumo final', '2026-06-10 13:40:00'),
('Luis Méndez', '+502 5900-1122', 'luis.mendez@mail.com', 10, 10, 5, 'Juan', 10, 9, 1, 'Eduardo', 5, 'live_music', NULL, NULL, 5, 'El gerente Eduardo pasó a saludarnos y la banda de música en vivo tocó excelente. Volveremos sin duda.', 'discount', '10% de descuento en tu consumo final', '2026-06-10 14:05:00'),
('María José Ortiz', '+502 4112-9988', 'mj.ortiz@mail.com', 5, 6, 2, 'Pedro', 6, 6, 0, NULL, 2, 'none', NULL, NULL, NULL, 'El mesero Pedro estuvo muy distraído. Tuvimos que pedir agua tres veces. La comida estaba fría.', 'discount', '10% de descuento en tu consumo final', '2026-06-10 14:30:00');
