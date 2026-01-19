-- Add comprehensive global news sources for travel safety monitoring
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/gnobnyzezkuyptuakztf/editor

INSERT INTO sources (name, url, enabled, category, type) VALUES
-- Global/International
('BBC News', 'https://www.bbc.com/news', true, 'global', 'web'),
('Reuters', 'https://www.reuters.com', true, 'global', 'web'),
('Al Jazeera English', 'https://www.aljazeera.com', true, 'global', 'web'),
('The Guardian International', 'https://www.theguardian.com/international', true, 'global', 'web'),
('Associated Press', 'https://apnews.com', true, 'global', 'web'),
('France 24', 'https://www.france24.com/en/', true, 'global', 'web'),

-- Asia-Pacific
('The Straits Times', 'https://www.straitstimes.com', true, 'asia', 'web'),
('South China Morning Post', 'https://www.scmp.com', true, 'asia', 'web'),
('The Japan Times', 'https://www.japantimes.co.jp', true, 'asia', 'web'),
('The Hindu', 'https://www.thehindu.com', true, 'asia', 'web'),
('Bangkok Post', 'https://www.bangkokpost.com', true, 'asia', 'web'),
('The Jakarta Post', 'https://www.jakartapost.com', true, 'asia', 'web'),
('New Straits Times Malaysia', 'https://www.nst.com.my', true, 'asia', 'web'),
('The Philippine Star', 'https://www.philstar.com', true, 'asia', 'web'),
('Vietnam News', 'https://vietnamnews.vn', true, 'asia', 'web'),

-- Middle East
('Haaretz', 'https://www.haaretz.com', true, 'middle-east', 'web'),
('The Times of Israel', 'https://www.timesofisrael.com', true, 'middle-east', 'web'),
('Arab News', 'https://www.arabnews.com', true, 'middle-east', 'web'),
('The National UAE', 'https://www.thenationalnews.com', true, 'middle-east', 'web'),
('Jordan Times', 'https://www.jordantimes.com', true, 'middle-east', 'web'),

-- Europe
('Deutsche Welle', 'https://www.dw.com/en/', true, 'europe', 'web'),
('The Local Europe', 'https://www.thelocal.com', true, 'europe', 'web'),
('Euronews', 'https://www.euronews.com', true, 'europe', 'web'),
('Irish Times', 'https://www.irishtimes.com', true, 'europe', 'web'),
('The Moscow Times', 'https://www.themoscowtimes.com', true, 'europe', 'web'),
('Kyiv Independent', 'https://kyivindependent.com', true, 'europe', 'web'),

-- Africa
('News24 South Africa', 'https://www.news24.com', true, 'africa', 'web'),
('Daily Nation Kenya', 'https://nation.africa', true, 'africa', 'web'),
('The East African', 'https://www.theeastafrican.co.ke', true, 'africa', 'web'),
('Egypt Independent', 'https://www.egyptindependent.com', true, 'africa', 'web'),
('Premium Times Nigeria', 'https://www.premiumtimesng.com', true, 'africa', 'web'),
('The Citizen Tanzania', 'https://www.thecitizen.co.tz', true, 'africa', 'web'),

-- Americas
('The New York Times', 'https://www.nytimes.com', true, 'americas', 'web'),
('The Washington Post', 'https://www.washingtonpost.com', true, 'americas', 'web'),
('Globe and Mail Canada', 'https://www.theglobeandmail.com', true, 'americas', 'web'),
('El País English', 'https://english.elpais.com', true, 'americas', 'web'),
('Buenos Aires Times', 'https://www.batimes.com.ar', true, 'americas', 'web'),
('Brazilian Report', 'https://brazilian.report', true, 'americas', 'web'),
('Mexico News Daily', 'https://mexiconewsdaily.com', true, 'americas', 'web'),
('Jamaica Observer', 'https://www.jamaicaobserver.com', true, 'americas', 'web'),

-- Caribbean
('Trinidad Express', 'https://trinidadexpress.com', true, 'caribbean', 'web'),
('Barbados Today', 'https://barbadostoday.bb', true, 'caribbean', 'web'),

-- Oceania
('The Sydney Morning Herald', 'https://www.smh.com.au', true, 'oceania', 'web'),
('New Zealand Herald', 'https://www.nzherald.co.nz', true, 'oceania', 'web'),
('The Australian', 'https://www.theaustralian.com.au', true, 'oceania', 'web'),

-- Travel/Security Specialized
('Travel Weekly', 'https://www.travelweekly.com', true, 'travel', 'web'),
('Skift Travel News', 'https://skift.com', true, 'travel', 'web'),
('Executive Traveller', 'https://www.executivetraveller.com', true, 'travel', 'web'),
('Travel + Leisure', 'https://www.travelandleisure.com', true, 'travel', 'web'),

-- Government Travel Advisory Feeds
('US State Dept Travel', 'https://travel.state.gov/content/travel.html', true, 'government', 'web'),
('UK Foreign Office', 'https://www.gov.uk/foreign-travel-advice', true, 'government', 'web'),
('Canadian Travel Advisories', 'https://travel.gc.ca/travelling/advisories', true, 'government', 'web'),
('Australian DFAT', 'https://www.smartraveller.gov.au', true, 'government', 'web');
