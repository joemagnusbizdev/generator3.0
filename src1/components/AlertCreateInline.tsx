/**
 * AlertCreateInline - Manual alert creation form
 * 
 * Creates alerts with all fields needed for healthy WordPress export:
 * - title (required) - Specific incident title, not boilerplate
 * - country (required) - For WP export and geo context
 * - location (required) - Specific location within country
 * - summary (required) - 2-3 sentences, concrete what/where
 * - recommendations (required) - 4-6 practical bullet points
 * - sources (recommended) - 1-3 URLs with optional titles
 * - severity (required) - critical/warning/caution/informative
 * - event_type - Type of event (conflict, natural disaster, etc.)
 * - geo fields - latitude, longitude, radius_km, geo_scope
 * - dates - event_start_date, event_end_date
 */
import React, { useState, useCallback, useMemo } from 'react';
import { apiPostJson } from '../lib/utils/api';
import { colors, styles, combine } from '../styles/inline';
import { buttons, cards, forms, typography, badges } from '../styles/designSystem';

// ============================================================================
// Types
// ============================================================================

type Severity = 'critical' | 'warning' | 'caution' | 'informative';

interface SourceInput {
  url: string;
  title?: string;
}

interface AlertFormData {
  title: string;
  country: string;
  region: string;
  location: string;
  summary: string;
  recommendations: string[];
  sources: SourceInput[];
  severity: Severity;
  event_type: string;
  geoJSON: string; // Mandatory GeoJSON string
  geo_scope: string;
  latitude: string;
  longitude: string;
  radius_km: string;
  event_start_date: string;
  event_end_date: string;
}

interface AlertCreateInlineProps {
  accessToken?: string;
  permissions?: {
    canCreate?: boolean;
  };
  onAlertCreated?: (alert: any) => void;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_OPTIONS: { value: Severity; label: string; description: string; color: string }[] = [
  { 
    value: 'critical', 
    label: 'Critical', 
    description: 'Mass-casualty events, major terrorist attacks, armed conflict escalation, imminent life-threatening hazards',
    color: colors.red600,
  },
  { 
    value: 'warning', 
    label: 'Warning', 
    description: 'Significant disruption, violence, unrest, major infrastructure impact',
    color: colors.orange600,
  },
  { 
    value: 'caution', 
    label: 'Caution', 
    description: 'Localized incidents, moderate disruption, travelers should take extra care',
    color: colors.warning,
  },
  { 
    value: 'informative', 
    label: 'Informative', 
    description: 'Routine advisories, low-impact updates, general reminders',
    color: colors.blue600,
  },
];

const EVENT_TYPES = [
  'Armed Conflict',
  'Terrorism',
  'Civil Unrest',
  'Political Instability',
  'Natural Disaster',
  'Health Emergency',
  'Infrastructure Disruption',
  'Crime / Safety',
  'Transportation Disruption',
  'Environmental Hazard',
  'Other',
];

const GEO_SCOPES = [
  'city',
  'region',
  'country',
  'multi-country',
];

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Bolivia', 'Bosnia and Herzegovina', 'Brazil', 'Bulgaria',
  'Cambodia', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Democratic Republic of Congo', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Estonia', 'Ethiopia',
  'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Libya', 'Lithuania', 'Luxembourg',
  'Malaysia', 'Mali', 'Malta', 'Mexico', 'Moldova', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman', 'Pakistan', 'Palestine', 'Panama', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar',
  'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Serbia', 'Singapore', 'Slovakia', 'Slovenia', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

// ============================================================================
// Initial Form State
// ============================================================================

const initialFormData: AlertFormData = {
  title: '',
  country: '',
  region: '',
  location: '',
  summary: '',
  recommendations: ['', '', '', ''],
  sources: [{ url: '', title: '' }],
  severity: 'informative',
  event_type: '',
  geoJSON: '',
  geo_scope: 'city',
  latitude: '',
  longitude: '',
  radius_km: '25',
  event_start_date: '',
  event_end_date: '',
};

// ============================================================================
// Component
// ============================================================================

export default function AlertCreateInline({
  accessToken,
  permissions,
  onAlertCreated,
}: AlertCreateInlineProps): JSX.Element | null {
  const [formData, setFormData] = useState<AlertFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Permission check
  if (permissions && !permissions.canCreate) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.gray500 }}>
        You don't have permission to create alerts.
      </div>
    );
  }

  // ============================================================================
  // Validation
  // ============================================================================

  const validation = useMemo(() => {
    const errors: string[] = [];
    
    if (!formData.title.trim()) errors.push('Title is required');
    if (formData.title.length < 10) errors.push('Title should be at least 10 characters');
    if (!formData.country) errors.push('Country is required');
    if (!formData.location.trim()) errors.push('Location is required');
    if (!formData.summary.trim()) errors.push('Summary is required');
    if (formData.summary.length < 50) errors.push('Summary should be at least 50 characters');
    
    const validAdvice = formData.recommendations.filter(a => a.trim());
    if (validAdvice.length < 2) errors.push('At least 2 recommendations items are required');
    
    const validSources = formData.sources.filter(s => s.url.trim());
    
    // Validate URLs
    for (const source of validSources) {
      try {
        new URL(source.url);
      } catch {
        errors.push(`Invalid URL: ${source.url}`);
      }
    }

    // GeoJSON validation (MANDATORY)
    if (!formData.geoJSON.trim()) {
      errors.push('GeoJSON is required. Provide a valid GeoJSON FeatureCollection, Feature, or geometry object.');
    } else {
      try {
        JSON.parse(formData.geoJSON);
      } catch {
        errors.push('Invalid GeoJSON format. Ensure it is valid JSON.');
      }
    }

    // Geo validation (optional)
    if (formData.latitude && formData.longitude) {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) errors.push('Latitude must be between -90 and 90');
      if (isNaN(lng) || lng < -180 || lng > 180) errors.push('Longitude must be between -180 and 180');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
    };
  }, [formData]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const updateField = useCallback(<K extends keyof AlertFormData>(
    field: K,
    value: AlertFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  }, []);

  const updateAdvice = useCallback((index: number, value: string) => {
    setFormData(prev => {
      const newAdvice = [...prev.recommendations];
      newAdvice[index] = value;
      return { ...prev, recommendations: newAdvice };
    });
  }, []);

  const addAdvice = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      recommendations: [...prev.recommendations, ''],
    }));
  }, []);

  const removeAdvice = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      recommendations: prev.recommendations.filter((_, i) => i !== index),
    }));
  }, []);

  const updateSource = useCallback((index: number, field: 'url' | 'title', value: string) => {
    setFormData(prev => {
      const newSources = [...prev.sources];
      newSources[index] = { ...newSources[index], [field]: value };
      return { ...prev, sources: newSources };
    });
  }, []);

  const addSource = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      sources: [...prev.sources, { url: '', title: '' }],
    }));
  }, []);

  const removeSource = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index),
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setError(null);
    setSuccess(null);
    setShowPreview(false);
  }, []);

  // ============================================================================
  // Submit
  // ============================================================================

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validation.isValid) {
      setError(validation.errors.join('. '));
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Build the alert payload
      const payload: Record<string, any> = {
        status: 'draft',
        title: formData.title.trim(),
        country: formData.country,
        region: formData.region.trim() || null,
        location: formData.location.trim(),
        summary: formData.summary.trim(),
        recommendations: formData.recommendations
          .filter(a => a.trim())
          .map(a => a.trim())
          .join('\n'),
        sources: formData.sources
          .filter(s => s.url.trim())
          .map(s => ({
            url: s.url.trim(),
            title: s.title?.trim() || undefined,
          })),
        severity: formData.severity,
        event_type: formData.event_type || null,
        geo_scope: formData.geo_scope || null,
        geoJSON: JSON.parse(formData.geoJSON),
      };

      // Add geo fields if provided
      if (formData.latitude && formData.longitude) {
        payload.latitude = parseFloat(formData.latitude);
        payload.longitude = parseFloat(formData.longitude);
        payload.radius_km = parseFloat(formData.radius_km) || 25;

        // Generate GeoJSON circle
        payload.geojson = generateCircleGeoJSON(
          payload.latitude,
          payload.longitude,
          payload.radius_km
        );
      }

      // Add dates if provided (store as ISO date strings, database converts to DATE type)
      if (formData.event_start_date) {
        payload.event_start_date = new Date(formData.event_start_date).toISOString().split('T')[0];
      }
      if (formData.event_end_date) {
        payload.event_end_date = new Date(formData.event_end_date).toISOString().split('T')[0];
      }

      const result = await apiPostJson<{ ok: boolean; alert?: any; error?: string }>(
        '/alerts',
        payload,
        accessToken
      );

      if (result.ok && result.alert) {
        setSuccess(`Alert created successfully! ID: ${result.alert.id}`);
        onAlertCreated?.(result.alert);
        resetForm();
      } else {
        throw new Error(result.error || 'Failed to create alert');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create alert';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [formData, validation, accessToken, onAlertCreated, resetForm]);

  // ============================================================================
  // GeoJSON Helper
  // ============================================================================

  function generateCircleGeoJSON(lat: number, lng: number, radiusKm: number): object {
    const earthKm = 6371;
    const angDist = radiusKm / earthKm;
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    const points = 28;

    const coords: [number, number][] = [];
    for (let i = 0; i <= points; i++) {
      const bearing = (2 * Math.PI * i) / points;
      const sinLat = Math.sin(latRad);
      const cosLat = Math.cos(latRad);
      const sinAng = Math.sin(angDist);
      const cosAng = Math.cos(angDist);

      const lat2 = Math.asin(sinLat * cosAng + cosLat * sinAng * Math.cos(bearing));
      const lng2 = lngRad + Math.atan2(
        Math.sin(bearing) * sinAng * cosLat,
        cosAng - sinLat * Math.sin(lat2)
      );

      coords.push([
        Number(((lng2 * 180) / Math.PI).toFixed(6)),
        Number(((lat2 * 180) / Math.PI).toFixed(6)),
      ]);
    }

    return {
      type: 'Feature',
      properties: { shape: 'circle', radiusKm },
      geometry: { type: 'Polygon', coordinates: [coords] },
    };
  }

  // ============================================================================
  // Styles
  // ============================================================================

  const containerStyle: React.CSSProperties = {
    padding: '1rem',
    maxWidth: '900px',
    margin: '0 auto',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '1.5rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: colors.magnusDarkGreen,
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: colors.gray600,
    marginTop: '0.5rem',
  };

  const sectionStyle: React.CSSProperties = {
    ...cards.base,
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: colors.magnusDarkText,
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: `1px solid ${colors.gray200}`,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '1rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: colors.gray700,
  };

  const requiredStyle: React.CSSProperties = {
    color: colors.red500,
    marginLeft: '2px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    border: `1px solid ${colors.gray300}`,
    borderRadius: '8px',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '100px',
    resize: 'vertical',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    backgroundColor: 'white',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  };

  const errorBoxStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: colors.red50,
    border: `1px solid ${colors.red200}`,
    borderRadius: '8px',
    color: colors.red700,
    marginBottom: '1rem',
  };

  const successBoxStyle: React.CSSProperties = {
    padding: '1rem',
    backgroundColor: colors.success + '15',
    border: `1px solid ${colors.success}`,
    borderRadius: '8px',
    color: colors.magnusDarkGreen,
    marginBottom: '1rem',
  };

  const warningBoxStyle: React.CSSProperties = {
    padding: '0.75rem',
    backgroundColor: colors.warning + '15',
    border: `1px solid ${colors.warning}`,
    borderRadius: '8px',
    color: colors.orange700,
    marginBottom: '1rem',
    fontSize: '0.875rem',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: colors.gray500,
    marginTop: '0.25rem',
  };

  // ============================================================================
  // Preview Component
  // ============================================================================

  function renderPreview(): JSX.Element {
    const previewHtml = `
      <p><strong>Country:</strong> ${formData.country || '(not set)'}</p>
      ${formData.location ? `<p><strong>Location:</strong> ${formData.location}</p>` : ''}
      ${formData.summary ? `<p>${formData.summary}</p>` : ''}
      ${formData.recommendations.filter(a => a.trim()).length > 0 
        ? `<h3>recommendations</h3><ul>${formData.recommendations.filter(a => a.trim()).map(a => `<li>${a}</li>`).join('')}</ul>` 
        : ''}
    `;

    return (
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}> WordPress Export Preview</h3>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: colors.gray50, 
          borderRadius: '8px',
          border: `1px solid ${colors.gray200}`,
        }}>
          <h4 style={{ margin: '0 0 1rem', color: colors.magnusDarkGreen }}>
            {formData.title || '(No title)'}
          </h4>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          
          {formData.sources.filter(s => s.url.trim()).length > 0 && (
            <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
              <strong>Sources:</strong>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem' }}>
                {formData.sources.filter(s => s.url.trim()).map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Create Alert</h2>
        <p style={subtitleStyle}>
          Create a travel safety alert for WordPress export. All required fields must be completed for a healthy export.
        </p>
      </div>

      {error && (
        <div style={errorBoxStyle}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={successBoxStyle}>
          <strong></strong> {success}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div style={warningBoxStyle}>
          <strong> Warning:</strong> {validation.warnings.join('. ')}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Info Section */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}> Basic Information</h3>
          
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Title <span style={requiredStyle}>*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => updateField('title', e.target.value)}
              style={inputStyle}
              placeholder="Specific incident title (e.g., 'Armed Clashes in Northern Region')"
              maxLength={200}
            />
            <div style={helpTextStyle}>
              Be specific about the incident. Avoid generic titles like "Travel Advisory".
            </div>
          </div>

          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Country <span style={requiredStyle}>*</span>
              </label>
              <select
                value={formData.country}
                onChange={e => updateField('country', e.target.value)}
                style={selectStyle}
              >
                <option value="">Select country...</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Region</label>
              <input
                type="text"
                value={formData.region}
                onChange={e => updateField('region', e.target.value)}
                style={inputStyle}
                placeholder="e.g., Northern Province"
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              Location <span style={requiredStyle}>*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={e => updateField('location', e.target.value)}
              style={inputStyle}
              placeholder="Specific location (e.g., 'Central District, Capital City')"
            />
          </div>

          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>
                Severity <span style={requiredStyle}>*</span>
              </label>
              <select
                value={formData.severity}
                onChange={e => updateField('severity', e.target.value as Severity)}
                style={{
                  ...selectStyle,
                  borderLeftWidth: '4px',
                  borderLeftColor: SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.color,
                }}
              >
                {SEVERITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div style={helpTextStyle}>
                {SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.description}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Event Type</label>
              <select
                value={formData.event_type}
                onChange={e => updateField('event_type', e.target.value)}
                style={selectStyle}
              >
                <option value="">Select type...</option>
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}> Content</h3>
          
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Summary <span style={requiredStyle}>*</span>
            </label>
            <textarea
              value={formData.summary}
              onChange={e => updateField('summary', e.target.value)}
              style={textareaStyle}
              placeholder="2-3 sentences describing the incident. Be concrete about what happened and where. Keep under 150 words."
              maxLength={800}
            />
            <div style={helpTextStyle}>
              {formData.summary.length}/800 characters. Aim for 50-150 words.
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>
              recommendations <span style={requiredStyle}>*</span> (minimum 2 items)
            </label>
            {formData.recommendations.map((item, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={item}
                  onChange={e => updateAdvice(index, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={`recommendations item ${index + 1} (e.g., "Avoid the affected area")`}
                />
                {formData.recommendations.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeAdvice(index)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: colors.red100,
                      color: colors.red600,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    
                  </button>
                )}
              </div>
            ))}
            {formData.recommendations.length < 8 && (
              <button
                type="button"
                onClick={addAdvice}
                style={{
                  ...buttons.secondary,
                  marginTop: '0.5rem',
                }}
              >
                + Add recommendations
              </button>
            )}
            <div style={helpTextStyle}>
              4-6 practical bullet points recommended for WordPress export.
            </div>
          </div>
        </div>

        {/* Sources Section */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}> Sources</h3>
          
          {formData.sources.map((source, index) => (
            <div key={index} style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr auto', 
              gap: '0.5rem', 
              marginBottom: '0.5rem',
              alignItems: 'start',
            }}>
              <div>
                <input
                  type="url"
                  value={source.url}
                  onChange={e => updateSource(index, 'url', e.target.value)}
                  style={inputStyle}
                  placeholder="https://..."
                />
              </div>
              <div>
                <input
                  type="text"
                  value={source.title || ''}
                  onChange={e => updateSource(index, 'title', e.target.value)}
                  style={inputStyle}
                  placeholder="Source title (optional)"
                />
              </div>
              {formData.sources.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSource(index)}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: colors.red100,
                    color: colors.red600,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  
                </button>
              )}
            </div>
          ))}
          {formData.sources.length < 3 && (
            <button
              type="button"
              onClick={addSource}
              style={{
                ...buttons.secondary,
                marginTop: '0.5rem',
              }}
            >
              + Add Source
            </button>
          )}
          <div style={helpTextStyle}>
            1-3 source URLs recommended. These will be included in the WordPress export.
          </div>
        </div>

        {/* Geo Section */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>🗺 Geographic Data</h3>
          
          <div style={fieldStyle}>
            <label style={labelStyle}>
              GeoJSON <span style={requiredStyle}>*</span>
            </label>
            <textarea
              value={formData.geoJSON}
              onChange={e => updateField('geoJSON', e.target.value)}
              style={{
                ...textareaStyle,
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
              placeholder={'{\n  "type": "Feature",\n  "geometry": {\n    "type": "Point",\n    "coordinates": [35.2137, 31.7683]\n  },\n  "properties": {}\n}'}
              rows={8}
            />
            <div style={helpTextStyle}>
              <strong>Required.</strong> Valid GeoJSON object (Point, Polygon, MultiPolygon, FeatureCollection, or Feature). Use tools like geojson.io to generate.
            </div>
          </div>
          
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Geo Scope <span style={{fontSize: '0.85rem', color: colors.gray500}}>(optional)</span></label>
              <select
                value={formData.geo_scope}
                onChange={e => updateField('geo_scope', e.target.value)}
                style={selectStyle}
              >
                {GEO_SCOPES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Latitude <span style={{fontSize: '0.85rem', color: colors.gray500}}>(optional)</span></label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={e => updateField('latitude', e.target.value)}
                style={inputStyle}
                placeholder="e.g., 31.7683"
                min="-90"
                max="90"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Longitude <span style={{fontSize: '0.85rem', color: colors.gray500}}>(optional)</span></label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={e => updateField('longitude', e.target.value)}
                style={inputStyle}
                placeholder="e.g., 35.2137"
                min="-180"
                max="180"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Radius (km) <span style={{fontSize: '0.85rem', color: colors.gray500}}>(optional)</span></label>
              <input
                type="number"
                value={formData.radius_km}
                onChange={e => updateField('radius_km', e.target.value)}
                style={inputStyle}
                placeholder="25"
                min="1"
                max="1000"
              />
            </div>
          </div>
        </div>

        {/* Dates Section */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}> Event Dates (Optional)</h3>
          
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Event Start</label>
              <input
                type="datetime-local"
                value={formData.event_start_date}
                onChange={e => updateField('event_start_date', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Event End</label>
              <input
                type="datetime-local"
                value={formData.event_end_date}
                onChange={e => updateField('event_end_date', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Preview Toggle */}
        {showPreview && renderPreview()}

        {/* Actions */}
        <div style={actionsStyle}>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            style={buttons.secondary}
          >
            {showPreview ? 'Hide Preview' : 'Show WP Preview'}
          </button>
          
          <button
            type="button"
            onClick={resetForm}
            style={buttons.secondary}
          >
            Reset Form
          </button>
          
          <button
            type="submit"
            disabled={submitting || !validation.isValid}
            style={{
              ...buttons.primary,
              opacity: (submitting || !validation.isValid) ? 0.6 : 1,
              cursor: (submitting || !validation.isValid) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Creating...' : 'Create Alert (Draft)'}
          </button>
        </div>

        {/* Validation Summary */}
        {!validation.isValid && (
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: colors.red600 }}>
            <strong>Please fix:</strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.5rem' }}>
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}

// Named export for flexibility
export { AlertCreateInline };












