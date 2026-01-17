import * as XLSX from 'xlsx';

export interface ParsedSource {
  name: string;
  url: string;
  country?: string;
  enabled?: boolean;
}

export async function parseExcelToSources(file: File): Promise<ParsedSource[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Map Excel columns to source format
        const sources: ParsedSource[] = jsonData.map((row: any) => ({
          name: row.name || row.Name || row.title || row.Title || row.NAME || 'Untitled Source',
          url: row.url || row.URL || row.link || row.Link || row.LINK || '',
          country: row.country || row.Country || row.COUNTRY || null,
          enabled: row.enabled !== undefined ? row.enabled : true,
        }));
        
        resolve(sources);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}




