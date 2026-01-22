-- Reddit RSS Feed Sources for Travel Alerts
-- Reddit RSS format: https://www.reddit.com/r/[subreddit]/.rss

INSERT INTO sources (name, url, country, enabled, query) VALUES
-- Travel Safety & News
('Reddit - r/travel', 'https://www.reddit.com/r/travel/.rss', 'Global', true, 'safety warning alert danger crisis'),
('Reddit - r/solotravel', 'https://www.reddit.com/r/solotravel/.rss', 'Global', true, 'safety warning danger alert'),
('Reddit - r/worldnews', 'https://www.reddit.com/r/worldnews/.rss', 'Global', true, 'travel alert warning evacuation'),

-- Regional Travel
('Reddit - r/Africa', 'https://www.reddit.com/r/Africa/.rss', 'Africa', true, 'crisis conflict alert emergency'),
('Reddit - r/europe', 'https://www.reddit.com/r/europe/.rss', 'Europe', true, 'travel alert warning emergency'),
('Reddit - r/asia', 'https://www.reddit.com/r/asia/.rss', 'Asia', true, 'crisis conflict alert emergency'),
('Reddit - r/LatinAmerica', 'https://www.reddit.com/r/LatinAmerica/.rss', 'Latin America', true, 'crisis conflict alert emergency'),
('Reddit - r/MiddleEast', 'https://www.reddit.com/r/MiddleEast/.rss', 'Middle East', true, 'crisis conflict alert emergency'),

-- Emergency & Crisis
('Reddit - r/news', 'https://www.reddit.com/r/news/.rss', 'Global', true, 'emergency disaster attack terror'),
('Reddit - r/disasters', 'https://www.reddit.com/r/disasters/.rss', 'Global', true, 'earthquake hurricane flood tsunami'),
('Reddit - r/geopolitics', 'https://www.reddit.com/r/geopolitics/.rss', 'Global', true, 'conflict war tension crisis'),

-- Country Specific
('Reddit - r/Mexico', 'https://www.reddit.com/r/mexico/.rss', 'Mexico', true, 'violence crime cartel safety'),
('Reddit - r/Ukraine', 'https://www.reddit.com/r/ukraine/.rss', 'Ukraine', true, 'war conflict attack military'),
('Reddit - r/Israel', 'https://www.reddit.com/r/Israel/.rss', 'Israel', true, 'attack terror security conflict'),
('Reddit - r/Turkey', 'https://www.reddit.com/r/Turkey/.rss', 'Turkey', true, 'earthquake crisis emergency'),
('Reddit - r/Russia', 'https://www.reddit.com/r/russia/.rss', 'Russia', true, 'conflict crisis emergency'),
('Reddit - r/China', 'https://www.reddit.com/r/China/.rss', 'China', true, 'crisis emergency lockdown'),
('Reddit - r/India', 'https://www.reddit.com/r/india/.rss', 'India', true, 'violence protest emergency disaster'),
('Reddit - r/Pakistan', 'https://www.reddit.com/r/pakistan/.rss', 'Pakistan', true, 'attack terror crisis emergency'),
('Reddit - r/Afghanistan', 'https://www.reddit.com/r/afghanistan/.rss', 'Afghanistan', true, 'attack terror crisis emergency'),

-- Aviation & Transportation
('Reddit - r/aviation', 'https://www.reddit.com/r/aviation/.rss', 'Global', true, 'crash incident emergency accident'),
('Reddit - r/AirCrashInvestigation', 'https://www.reddit.com/r/AirCrashInvestigation/.rss', 'Global', true, 'crash incident emergency'),

-- Health & Disease
('Reddit - r/Coronavirus', 'https://www.reddit.com/r/Coronavirus/.rss', 'Global', true, 'outbreak lockdown restriction'),
('Reddit - r/Epidemiology', 'https://www.reddit.com/r/epidemiology/.rss', 'Global', true, 'outbreak disease epidemic'),

-- Security & Crime
('Reddit - r/worldpolitics', 'https://www.reddit.com/r/worldpolitics/.rss', 'Global', true, 'conflict war protest crisis'),
('Reddit - r/TrueCrime', 'https://www.reddit.com/r/TrueCrime/.rss', 'Global', true, 'murder attack violence'),

-- Weather & Natural Disasters
('Reddit - r/weather', 'https://www.reddit.com/r/weather/.rss', 'Global', true, 'hurricane tornado storm flood'),
('Reddit - r/TropicalWeather', 'https://www.reddit.com/r/TropicalWeather/.rss', 'Global', true, 'hurricane cyclone typhoon'),
('Reddit - r/Earthquake', 'https://www.reddit.com/r/earthquake/.rss', 'Global', true, 'earthquake tremor seismic'),

-- Expat & Digital Nomad Communities
('Reddit - r/expats', 'https://www.reddit.com/r/expats/.rss', 'Global', true, 'safety warning danger crisis'),
('Reddit - r/digitalnomad', 'https://www.reddit.com/r/digitalnomad/.rss', 'Global', true, 'safety warning danger crime')

ON CONFLICT (url) DO NOTHING;
