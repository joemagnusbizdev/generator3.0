import * as XLSX from 'xlsx';
function validateTrustScore(value) {
    if (value === null || value === undefined || value === '')
        return 0.5;
    const num = parseFloat(value);
    if (isNaN(num))
        return 0.5;
    return Math.max(0, Math.min(1, num)); // Clamp to 0.0-1.0
}
function parseBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
    }
    if (typeof value === 'number')
        return value === 1;
    return true; // Default enabled
}
function cleanUrl(url) {
    if (!url)
        return '';
    let cleaned = url.trim();
    if (cleaned && !cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
    }
    return cleaned;
}
export async function parseExcelToSources(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                const sources = jsonData.map((row) => {
                    const name = row.name || row.Name || row.title || row.Title || row.NAME || 'Untitled Source';
                    const url = cleanUrl(row.url || row.URL || row.link || row.Link || row.LINK || '');
                    const country = row.country || row.Country || row.COUNTRY || undefined;
                    const type = (row.type || row.Type || row.TYPE || 'generic-rss').toLowerCase();
                    const query = row.query || row.Query || row.QUERY || '';
                    const trust_score = validateTrustScore(row.trust_score || row['trust_score'] || row['Trust Score'] || row['trust score']);
                    const enabled = parseBoolean(row.enabled || row.Enabled || row.ENABLED);
                    return {
                        name: name.trim(),
                        url: url,
                        country: country ? country.trim() : undefined,
                        type: type.trim() || 'generic-rss',
                        query: query ? query.trim() : undefined,
                        trust_score,
                        enabled,
                    };
                });
                resolve(sources);
            }
            catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}
