-- Disable first 15 sources to debug hanging at position 14
UPDATE sources SET enabled = false WHERE name IN (
  'BBC News',
  'Reuters',
  'Al Jazeera English',
  'The Guardian International',
  'Associated Press',
  'France 24',
  'The Straits Times',
  'South China Morning Post',
  'The Japan Times',
  'The Hindu',
  'Bangkok Post',
  'The Jakarta Post',
  'New Straits Times Malaysia',
  'The Philippine Star',
  'Vietnam News'
);
