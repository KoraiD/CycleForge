-- Seed historical rides for "similar rides" queries.
-- Requires schema.sql to have been applied.

INSERT INTO routes (
  route_id, session_id, label, profile,
  distance_m, duration_s, elev_gain_m, elev_loss_m,
  geometry_geojson, elev_km, elev_m,
  ors_extras_json, weather_json, tips, training_json, is_seed
) VALUES
('seed-1', 'seed', 'Amstel dawn 40k', 'endurance-flat', 40200, 5400, 48, 48, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Steady canal miles'], '{"tssEst":72,"stimulus":"endurance"}', 1),
('seed-2', 'seed', 'Bosbaan tempo', 'tempo', 35500, 4500, 62, 62, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Open stretches for tempo'], '{"tssEst":95,"stimulus":"tempo"}', 1),
('seed-3', 'seed', 'Waterland Sunday', 'hilly-loop', 62000, 9000, 180, 180, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['North of the IJ'], '{"tssEst":130,"stimulus":"climb"}', 1),
('seed-4', 'seed', 'Vondel easy spin', 'easy', 22000, 3600, 28, 28, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Recovery pace'], '{"tssEst":40,"stimulus":"recovery"}', 1),
('seed-5', 'seed', 'North sea wind', 'endurance-flat', 51000, 7200, 95, 95, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Expect headwind home'], '{"tssEst":110,"stimulus":"endurance"}', 1),
('seed-6', 'seed', 'Ouderkerk loop', 'rolling-endurance', 44500, 6000, 70, 70, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Classic south loop'], '{"tssEst":85,"stimulus":"endurance"}', 1),
('seed-7', 'seed', 'IJ tunnel out-n-back', 'endurance-flat', 28000, 3900, 35, 35, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Mind the tunnel gusts'], '{"tssEst":55,"stimulus":"endurance"}', 1),
('seed-8', 'seed', 'Hilversum rollers', 'hilly-loop', 70000, 10800, 420, 420, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Real hills for Amsterdam'], '{"tssEst":160,"stimulus":"climb"}', 1),
('seed-9', 'seed', 'Sloterplas circuit', 'easy', 18000, 3000, 20, 20, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Flat recovery'], '{"tssEst":32,"stimulus":"recovery"}', 1),
('seed-10', 'seed', 'Diemen parkways', 'rolling-endurance', 38000, 5100, 55, 55, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Quiet bike paths'], '{"tssEst":78,"stimulus":"endurance"}', 1),
('seed-11', 'seed', 'Aalsmeer greenhouse loop', 'endurance-flat', 56000, 7800, 60, 60, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Long south grind'], '{"tssEst":105,"stimulus":"endurance"}', 1),
('seed-12', 'seed', 'Zaandam windmills', 'rolling-endurance', 48000, 6600, 88, 88, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Scenic north'], '{"tssEst":92,"stimulus":"endurance"}', 1),
('seed-13', 'seed', 'Muiden castle dash', 'tempo', 42000, 4800, 50, 50, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Tempo on the dike'], '{"tssEst":100,"stimulus":"tempo"}', 1),
('seed-14', 'seed', 'Amsterdamse Bos intervals', 'tempo', 30000, 4200, 45, 45, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Lap the bos'], '{"tssEst":88,"stimulus":"tempo"}', 1),
('seed-15', 'seed', 'Marken peninsula', 'hilly-loop', 75000, 11400, 210, 210, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Long day out'], '{"tssEst":150,"stimulus":"climb"}', 1),
('seed-16', 'seed', 'Centraal coffee spin', 'easy', 15000, 2700, 18, 18, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['City recovery'], '{"tssEst":28,"stimulus":"recovery"}', 1),
('seed-17', 'seed', 'Amstel–Ouderkerk brick', 'endurance-flat', 50000, 6900, 65, 65, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Brick-road awareness'], '{"tssEst":98,"stimulus":"endurance"}', 1),
('seed-18', 'seed', 'Westpoort industrial', 'endurance-flat', 36000, 4800, 40, 40, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Wide roads, windy'], '{"tssEst":70,"stimulus":"endurance"}', 1),
('seed-19', 'seed', 'Het Gooi climb day', 'hilly-loop', 80000, 12600, 520, 520, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Best climbing nearby'], '{"tssEst":175,"stimulus":"climb"}', 1),
('seed-20', 'seed', 'Twiske nature loop', 'rolling-endurance', 46000, 6300, 75, 75, '{"type":"LineString","coordinates":[]}', [], [], '{}', '{}', ['Gravel-adjacent paths'], '{"tssEst":90,"stimulus":"endurance"}', 1);
