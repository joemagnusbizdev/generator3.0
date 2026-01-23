-- Migration: Permanently delete noisy/news sources provided by user
-- This creates a backup table first, then deletes the matching rows from public.sources
BEGIN;

-- Create a backup table (structure copy) if not exists
CREATE TABLE IF NOT EXISTS public.sources_deleted_backup (LIKE public.sources INCLUDING ALL);

-- Back up the rows we're about to delete
INSERT INTO public.sources_deleted_backup
SELECT * FROM public.sources
WHERE url IN (
  'https://reliefweb.int/updates/rss.xml',
  'https://reliefweb.int/reports/rss.xml',
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom',
  'https://alerts.weather.gov/cap/us.php?x=0',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=multiple%20fatalities&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=shooting&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=riot&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=general%20strike&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=shutdown%20city&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%22free%20palestine%22%20protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%22pro-palestine%22%20protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%22ceasefire%20now%22%20protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=manifestation%20palestine&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=manifestaci%C3%B3n%20palestina&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=proteste%20pal%C3%A4stina&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%D8%AA%D8%B8%D8%A7%D9%87%D8%B1%D8%A9%20%D9%81%D9%84%D8%B3%D8%B7%D9%8A%D9%86&format=json',
  'https://news.google.com/rss',
  'https://news.google.com/rss/search?q=violent%20protest',
  'https://news.google.com/rss/search?q=general%20strike',
  'https://news.google.com/rss/search?q=%22free%20palestine%22%20protest',
  'https://news.google.com/rss/search?q=%22pro-palestine%22%20protest',
  'https://www.reddit.com/r/worldnews/new/.rss',
  'https://www.reddit.com/r/news/new/.rss',
  'https://www.reddit.com/r/geopolitics/new/.rss',
  'https://www.reddit.com/r/PublicFreakout/new/.rss',
  'https://en.wikipedia.org/w/index.php?title=Portal:Current_events&feed=atom',
  'https://www.reutersagency.com/feed/?best-topics=world',
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.theguardian.com/world/rss',
  'https://www.crisisgroup.org/rss.xml',
  'https://www.bellingcat.com/feed/'
);

-- Permanently delete the sources
DELETE FROM public.sources
WHERE url IN (
  'https://reliefweb.int/updates/rss.xml',
  'https://reliefweb.int/reports/rss.xml',
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom',
  'https://alerts.weather.gov/cap/us.php?x=0',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=multiple%20fatalities&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=shooting&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=riot&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=general%20strike&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=shutdown%20city&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%22free%20palestine%22%20protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%22pro-palestine%22%20protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%22ceasefire%20now%22%20protest&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=manifestation%20palestine&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=manifestaci%C3%B3n%20palestina&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=proteste%20pal%C3%A4stina&format=json',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=%D8%AA%D8%B8%D8%A7%D9%87%D8%B1%D8%A9%20%D9%81%D9%84%D8%B3%D8%B7%D9%8A%D9%86&format=json',
  'https://news.google.com/rss',
  'https://news.google.com/rss/search?q=violent%20protest',
  'https://news.google.com/rss/search?q=general%20strike',
  'https://news.google.com/rss/search?q=%22free%20palestine%22%20protest',
  'https://news.google.com/rss/search?q=%22pro-palestine%22%20protest',
  'https://www.reddit.com/r/worldnews/new/.rss',
  'https://www.reddit.com/r/news/new/.rss',
  'https://www.reddit.com/r/geopolitics/new/.rss',
  'https://www.reddit.com/r/PublicFreakout/new/.rss',
  'https://en.wikipedia.org/w/index.php?title=Portal:Current_events&feed=atom',
  'https://www.reutersagency.com/feed/?best-topics=world',
  'https://feeds.bbci.co.uk/news/rss.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.theguardian.com/world/rss',
  'https://www.crisisgroup.org/rss.xml',
  'https://www.bellingcat.com/feed/'
);

COMMIT;

-- Verification notes:
-- After applying, run:
-- SELECT id, name, url FROM public.sources_deleted_backup;
-- SELECT id, name, url FROM public.sources WHERE url IN (...);
