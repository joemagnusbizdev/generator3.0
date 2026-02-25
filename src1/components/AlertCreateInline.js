import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * AlertCreateInline - Manual alert creation form
 *
 * Creates alerts with all fields needed for healthy WordPress export:
 * - title (required) - Specific incident title, not boilerplate
 * - country (required) - For WP export and geo context
 * - mainland (required) - Continent/region for WordPress (Africa, Antarctica, Asia, Europe, North America, Australia (Oceania), South America)
 * - summary (required) - 2-3 sentences, concrete what/where
 * - recommendations (required) - 4-6 practical bullet points
 * - sources (recommended) - 1-3 URLs with optional titles
 * - severity (required) - critical/warning/caution/informative
 * - event_type - Type of event (conflict, natural disaster, etc.)
 * - geo fields - latitude, longitude, radius_km, geo_scope
 * - dates - event_start_date, event_end_date
 */
import { useState, useCallback, useMemo } from 'react';
import GeoJSONGeneratorModal from './GeoJSONGeneratorModal';
import { apiPostJson } from '../lib/utils/api';
import { colors } from '../styles/inline';
import { buttons, cards } from '../styles/designSystem';
// ============================================================================
// Constants
// ============================================================================
const SEVERITY_OPTIONS = [
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
const initialFormData = {
    title: '',
    country: '',
    mainland: '',
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
export default function AlertCreateInline({ accessToken, permissions, onAlertCreated, }) {
    const [formData, setFormData] = useState(initialFormData);
    const [showGeoModal, setShowGeoModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    // Permission check
    if (permissions && !permissions.canCreate) {
        return (_jsx("div", { style: { padding: '2rem', textAlign: 'center', color: colors.gray500 }, children: "You don't have permission to create alerts." }));
    }
    // ============================================================================
    // Validation
    // ============================================================================
    const validation = useMemo(() => {
        const errors = [];
        if (!formData.title.trim())
            errors.push('Title is required');
        if (formData.title.length < 10)
            errors.push('Title should be at least 10 characters');
        if (!formData.country)
            errors.push('Country is required');
        if (!formData.mainland.trim())
            errors.push('Mainland is required');
        if (!formData.location.trim())
            errors.push('City/Location is required');
        if (!formData.summary.trim())
            errors.push('Summary is required');
        if (formData.summary.length < 50)
            errors.push('Summary should be at least 50 characters');
        if (!formData.event_start_date)
            errors.push('Event start date is required');
        if (!formData.event_end_date)
            errors.push('Event end date is required');
        const validAdvice = formData.recommendations.filter(a => a.trim());
        if (validAdvice.length < 2)
            errors.push('At least 2 recommendations items are required');
        const validSources = formData.sources.filter(s => s.url.trim());
        // Validate URLs
        for (const source of validSources) {
            try {
                new URL(source.url);
            }
            catch {
                errors.push(`Invalid URL: ${source.url}`);
            }
        }
        // GeoJSON validation (OPTIONAL for manual alerts - can be added later in review queue)
        if (formData.geoJSON.trim()) {
            try {
                JSON.parse(formData.geoJSON);
            }
            catch {
                errors.push('Invalid GeoJSON format. Ensure it is valid JSON.');
            }
        }
        // Validate coordinates if provided (optional, but must be valid if present)
        if (formData.latitude.trim() || formData.longitude.trim()) {
            const lat = parseFloat(formData.latitude);
            const lng = parseFloat(formData.longitude);
            if (isNaN(lat) || lat < -90 || lat > 90)
                errors.push('Latitude must be between -90 and 90');
            if (isNaN(lng) || lng < -180 || lng > 180)
                errors.push('Longitude must be between -180 and 180');
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
    const updateField = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
        setSuccess(null);
    }, []);
    const updateAdvice = useCallback((index, value) => {
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
    const removeAdvice = useCallback((index) => {
        setFormData(prev => ({
            ...prev,
            recommendations: prev.recommendations.filter((_, i) => i !== index),
        }));
    }, []);
    const updateSource = useCallback((index, field, value) => {
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
    const removeSource = useCallback((index) => {
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
    // Action Handlers
    // ============================================================================
    const handleSaveDraft = useCallback(async () => {
        if (!validation.isValid) {
            setError(validation.errors.join('. '));
            return;
        }
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        try {
            // Build the alert payload - include all fields needed for WordPress export
            const recommendationsText = formData.recommendations
                .filter(a => a.trim())
                .map((a, i) => `${i + 1}. ${a.trim()}`)
                .join('\n');
            const cleanSummary = formData.summary.trim();
            const payload = {
                status: 'draft',
                title: formData.title.trim(),
                country: formData.country.trim(),
                mainland: formData.mainland.trim() || null,
                region: formData.mainland.trim() || null,
                location: formData.location.trim(),
                summary: cleanSummary,
                description: cleanSummary, // explicit for ACF - use summary as description
                recommendations: formData.recommendations
                    .filter(a => a.trim())
                    .map((a, i) => `${i + 1}. ${a.trim()}`)
                    .join('\n') || '',
                sources: formData.sources
                    .filter(s => s.url.trim())
                    .map(s => ({
                    url: s.url.trim(),
                    title: s.title?.trim() || undefined,
                })),
                severity: formData.severity,
                event_type: formData.event_type || null,
                intelligence_topics: formData.event_type || null,
                latitude: formData.latitude.trim() || null,
                longitude: formData.longitude.trim() || null,
                radius: formData.radius_km ? parseFloat(formData.radius_km) : null,
            };
            // Add dates if provided
            if (formData.event_start_date) {
                payload.event_start_date = new Date(formData.event_start_date).toISOString().split('T')[0];
            }
            if (formData.event_end_date) {
                payload.event_end_date = new Date(formData.event_end_date).toISOString().split('T')[0];
            }
            // GeoJSON is OPTIONAL - only include if user pasted one
            if (formData.geoJSON.trim()) {
                try {
                    const geoJsonObject = JSON.parse(formData.geoJSON);
                    payload.geo_json = geoJsonObject;
                    payload.geojson = JSON.stringify(geoJsonObject);
                    console.log('[Alert Create] Added optional GeoJSON to payload');
                }
                catch (err) {
                    console.warn('[Alert Create] Failed to parse optional GeoJSON:', err);
                    // Continue without GeoJSON - not required for manual alerts
                }
            }
            const result = await apiPostJson('/alerts', payload, accessToken);
            if (result.ok && result.alert) {
                setSuccess(`Draft saved successfully! ID: ${result.alert.id}`);
                onAlertCreated?.(result.alert);
                resetForm();
            }
            else {
                throw new Error(result.error || 'Failed to create alert');
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to create alert';
            setError(message);
        }
        finally {
            setSubmitting(false);
        }
    }, [formData, validation, accessToken, onAlertCreated, resetForm]);
    const handlePostAndCopy = useCallback(async () => {
        if (!validation.isValid) {
            setError(validation.errors.join('. '));
            return;
        }
        setSubmitting(true);
        try {
            // First create and post the alert
            const createResult = await apiPostJson('/alerts', {
                title: formData.title,
                summary: formData.summary,
                location: formData.location,
                country: formData.country,
                region: formData.location,
                mainland: formData.mainland,
                event_type: formData.event_type,
                severity: formData.severity,
                recommendations: formData.recommendations.filter(r => r.trim()),
                sources: formData.sources.filter(s => s.url.trim()).map(s => ({ url: s.url, title: s.title || s.url })),
                article_url: formData.sources[0]?.url || '',
                source_url: formData.sources[0]?.url || '',
                latitude: parseFloat(formData.latitude) || 0,
                longitude: parseFloat(formData.longitude) || 0,
                radiusKm: parseFloat(formData.radius_km) || 25,
                geo_json: formData.geoJSON ? JSON.parse(formData.geoJSON) : undefined,
                geojson: formData.geoJSON,
                event_start_date: formData.event_start_date || undefined,
                event_end_date: formData.event_end_date || undefined,
            }, accessToken);
            if (!createResult.ok || !createResult.alert) {
                throw new Error(createResult.error || 'Failed to create alert');
            }
            // Then publish to WordPress
            const publishResult = await apiPostJson(`/alerts/${createResult.alert.id}/publish`, {}, accessToken);
            if (publishResult.ok) {
                // Now copy to clipboard using same formatting as handleCopyWhatsApp
                let copiedSuccessfully = false;
                try {
                    // Format for WhatsApp (same logic as handleCopyWhatsApp)
                    const formatDateRange = (start, end) => {
                        if (!start)
                            return '';
                        const formatDate = (dateStr) => {
                            const d = new Date(dateStr);
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                        };
                        const startStr = formatDate(start);
                        if (!end)
                            return startStr;
                        const endStr = formatDate(end);
                        if (start === end)
                            return startStr;
                        return `${startStr} - ${endStr}`;
                    };
                    const dateRange = formatDateRange(formData.event_start_date, formData.event_end_date);
                    const recText = formData.recommendations
                        .filter(r => r.trim())
                        .map((r, i) => `${i + 1}. ${r.trim()}`)
                        .join('\n');
                    const whatsappTemplate = `📍 *Location:* ${formData.location.trim()}, ${formData.country.trim()}${dateRange ? `\n📅 *Date:* ${dateRange}` : ''}\n\n` +
                        `*${formData.title.trim()}*\n\n` +
                        `${formData.summary.trim()}\n\n` +
                        (recText ? `*Traveler Recommendations:*\n${recText}\n\n` : '');
                    console.log('Attempting to copy WhatsApp template to clipboard...');
                    console.log('Template length:', whatsappTemplate.length);
                    // Use the modern Clipboard API
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(whatsappTemplate);
                        copiedSuccessfully = true;
                        console.log('✅ Successfully copied to clipboard via Clipboard API');
                    }
                    else {
                        // Fallback for older browsers
                        console.warn('Clipboard API not available, attempting fallback...');
                        const textArea = document.createElement('textarea');
                        textArea.value = whatsappTemplate;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        const success = document.execCommand('copy');
                        document.body.removeChild(textArea);
                        if (success) {
                            copiedSuccessfully = true;
                            console.log('✅ Successfully copied to clipboard via execCommand fallback');
                        }
                        else {
                            console.error('❌ Fallback copy failed');
                        }
                    }
                }
                catch (clipErr) {
                    console.error('Failed to copy to clipboard:', clipErr);
                }
                if (copiedSuccessfully) {
                    setSuccess(`Alert posted to WordPress successfully! WhatsApp template copied to clipboard.`);
                }
                else {
                    setSuccess(`Alert posted to WordPress successfully, but could not copy WhatsApp template to clipboard. Please use "Copy to WhatsApp" button instead.`);
                }
                onAlertCreated?.(createResult.alert);
                resetForm();
            }
            else {
                // Build detailed error message
                const errorParts = [];
                if (publishResult.error)
                    errorParts.push(publishResult.error);
                if (publishResult.message)
                    errorParts.push(publishResult.message);
                if (publishResult.wordpress_error_text) {
                    try {
                        const wpError = JSON.parse(publishResult.wordpress_error_text);
                        if (wpError.message)
                            errorParts.push(`WordPress: ${wpError.message}`);
                        if (wpError.code)
                            errorParts.push(`Code: ${wpError.code}`);
                    }
                    catch {
                        errorParts.push(`WordPress: ${publishResult.wordpress_error_text.substring(0, 200)}`);
                    }
                }
                const finalError = errorParts.length > 0 ? errorParts.join('\n') : 'Failed to publish to WordPress';
                throw new Error(finalError);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to post alert';
            setError(message);
        }
        finally {
            setSubmitting(false);
        }
    }, [formData, validation, accessToken, onAlertCreated, resetForm]);
    const handlePost = useCallback(async () => {
        if (!validation.isValid) {
            setError(validation.errors.join('. '));
            return;
        }
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        try {
            // First create as draft
            const recommendationsText = formData.recommendations
                .filter(a => a.trim())
                .map((a, i) => `${i + 1}. ${a.trim()}`)
                .join('\n');
            const payload = {
                status: 'draft',
                title: formData.title.trim(),
                country: formData.country.trim(),
                mainland: formData.mainland.trim() || null,
                region: formData.mainland.trim() || null,
                location: formData.location.trim(),
                summary: formData.summary.trim(), // Clean summary, no recommendations
                description: formData.summary.trim(), // Same as summary for ACF
                recommendations: recommendationsText || null, // Separate field
                sources: formData.sources
                    .filter(s => s.url.trim())
                    .map(s => ({
                    url: s.url.trim(),
                    title: s.title?.trim() || undefined,
                })),
                severity: formData.severity,
                event_type: formData.event_type || null,
                intelligence_topics: formData.event_type || null, // For ACF normalization
                latitude: formData.latitude.trim() || null,
                longitude: formData.longitude.trim() || null,
                radius: formData.radius_km ? parseFloat(formData.radius_km) : null,
            };
            // Add dates if provided
            if (formData.event_start_date) {
                payload.event_start_date = new Date(formData.event_start_date).toISOString().split('T')[0];
            }
            if (formData.event_end_date) {
                payload.event_end_date = new Date(formData.event_end_date).toISOString().split('T')[0];
            }
            // Use pasted GeoJSON (required for manual alerts - no auto-generation)
            let geoJsonObject = null;
            if (formData.geoJSON.trim()) {
                try {
                    geoJsonObject = JSON.parse(formData.geoJSON);
                    console.log('[Alert Create] Parsed pasted GeoJSON for publish');
                }
                catch {
                    console.warn('GeoJSON parse failed during submit (should be caught by validation)');
                }
            }
            // Populate BOTH geo_json (JSONB) and geojson (TEXT) fields for WordPress compatibility
            if (geoJsonObject) {
                payload.geo_json = geoJsonObject;
                payload.geojson = JSON.stringify(geoJsonObject);
                console.log('[Alert Create] Added polygon to payload for publish');
            }
            const createResult = await apiPostJson('/alerts', payload, accessToken);
            if (!createResult.ok || !createResult.alert) {
                throw new Error(createResult.error || 'Failed to create alert');
            }
            // Then publish to WordPress
            const publishResult = await apiPostJson(`/alerts/${createResult.alert.id}/publish`, {}, accessToken);
            if (publishResult.ok) {
                setSuccess(`Alert posted to WordPress successfully!`);
                onAlertCreated?.(createResult.alert);
                resetForm();
            }
            else {
                // Build detailed error message
                const errorParts = [];
                if (publishResult.error)
                    errorParts.push(publishResult.error);
                if (publishResult.message)
                    errorParts.push(publishResult.message);
                if (publishResult.wordpress_error_text) {
                    try {
                        const wpError = JSON.parse(publishResult.wordpress_error_text);
                        if (wpError.message)
                            errorParts.push(`WordPress: ${wpError.message}`);
                        if (wpError.code)
                            errorParts.push(`Code: ${wpError.code}`);
                    }
                    catch {
                        errorParts.push(`WordPress: ${publishResult.wordpress_error_text.substring(0, 200)}`);
                    }
                }
                const finalError = errorParts.length > 0 ? errorParts.join('\n') : 'Failed to publish to WordPress';
                throw new Error(finalError);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to post alert';
            setError(message);
        }
        finally {
            setSubmitting(false);
        }
    }, [formData, validation, accessToken, onAlertCreated, resetForm]);
    const handleCopyWhatsApp = useCallback(async () => {
        if (!validation.isValid) {
            setError(validation.errors.join('. '));
            return;
        }
        try {
            // Format for WhatsApp
            const formatDateRange = (start, end) => {
                if (!start)
                    return '';
                const formatDate = (dateStr) => {
                    const d = new Date(dateStr);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                };
                const startStr = formatDate(start);
                if (!end)
                    return startStr;
                const endStr = formatDate(end);
                if (start === end)
                    return startStr;
                return `${startStr} - ${endStr}`;
            };
            const dateRange = formatDateRange(formData.event_start_date, formData.event_end_date);
            const recText = formData.recommendations
                .filter(r => r.trim())
                .map((r, i) => `${i + 1}. ${r.trim()}`)
                .join('\n');
            const whatsappText = `📍 *Location:* ${formData.location.trim()}, ${formData.country.trim()}${dateRange ? `\n📅 *Date:* ${dateRange}` : ''}\n\n` +
                `*${formData.title.trim()}*\n\n` +
                `${formData.summary.trim()}\n\n` +
                (recText ? `*Traveler Recommendations:*\n${recText}\n\n` : '');
            await navigator.clipboard.writeText(whatsappText);
            setSuccess('Copied to clipboard in WhatsApp format!');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to copy to clipboard';
            setError(message);
        }
    }, [formData, validation]);
    const handleDiscard = useCallback(() => {
        if (confirm('Are you sure you want to discard this alert? This cannot be undone.')) {
            resetForm();
            setSuccess('Alert discarded');
        }
    }, [resetForm]);
    // ============================================================================
    // GeoJSON Helper
    // ============================================================================
    function generateCircleGeoJSON(lat, lng, radiusKm) {
        const earthKm = 6371;
        const angDist = radiusKm / earthKm;
        const latRad = (lat * Math.PI) / 180;
        const lngRad = (lng * Math.PI) / 180;
        const points = 28;
        const coords = [];
        for (let i = 0; i <= points; i++) {
            const bearing = (2 * Math.PI * i) / points;
            const sinLat = Math.sin(latRad);
            const cosLat = Math.cos(latRad);
            const sinAng = Math.sin(angDist);
            const cosAng = Math.cos(angDist);
            const lat2 = Math.asin(sinLat * cosAng + cosLat * sinAng * Math.cos(bearing));
            const lng2 = lngRad + Math.atan2(Math.sin(bearing) * sinAng * cosLat, cosAng - sinLat * Math.sin(lat2));
            coords.push([
                Number(((lng2 * 180) / Math.PI).toFixed(6)),
                Number(((lat2 * 180) / Math.PI).toFixed(6)),
            ]);
        }
        // Ensure polygon is explicitly closed (first point repeated as last)
        if (coords.length && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
            coords.push(coords[0]);
        }
        return {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [coords] },
        };
    }
    // ============================================================================
    // Styles
    // ============================================================================
    const containerStyle = {
        padding: '1rem',
        maxWidth: '900px',
        margin: '0 auto',
    };
    const headerStyle = {
        marginBottom: '1.5rem',
    };
    const titleStyle = {
        fontSize: '1.5rem',
        fontWeight: 600,
        color: colors.magnusDarkGreen,
        margin: 0,
    };
    const subtitleStyle = {
        fontSize: '0.875rem',
        color: colors.gray600,
        marginTop: '0.5rem',
    };
    const sectionStyle = {
        ...cards.base,
        padding: '1.5rem',
        marginBottom: '1.5rem',
    };
    const sectionTitleStyle = {
        fontSize: '1.125rem',
        fontWeight: 600,
        color: colors.magnusDarkText,
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: `1px solid ${colors.gray200}`,
    };
    const fieldStyle = {
        marginBottom: '1rem',
    };
    const labelStyle = {
        display: 'block',
        marginBottom: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: colors.gray700,
    };
    const requiredStyle = {
        color: colors.red500,
        marginLeft: '2px',
    };
    const inputStyle = {
        width: '100%',
        padding: '0.75rem',
        border: `1px solid ${colors.gray300}`,
        borderRadius: '8px',
        fontSize: '1rem',
        transition: 'border-color 0.2s',
    };
    const textareaStyle = {
        ...inputStyle,
        minHeight: '100px',
        resize: 'vertical',
    };
    const selectStyle = {
        ...inputStyle,
        backgroundColor: 'white',
    };
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
    };
    const errorBoxStyle = {
        padding: '1rem',
        backgroundColor: colors.red50,
        border: `1px solid ${colors.red200}`,
        borderRadius: '8px',
        color: colors.red700,
        marginBottom: '1rem',
    };
    const successBoxStyle = {
        padding: '1rem',
        backgroundColor: colors.success + '15',
        border: `1px solid ${colors.success}`,
        borderRadius: '8px',
        color: colors.magnusDarkGreen,
        marginBottom: '1rem',
    };
    const warningBoxStyle = {
        padding: '0.75rem',
        backgroundColor: colors.warning + '15',
        border: `1px solid ${colors.warning}`,
        borderRadius: '8px',
        color: colors.orange700,
        marginBottom: '1rem',
        fontSize: '0.875rem',
    };
    const actionsStyle = {
        display: 'flex',
        gap: '1rem',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
    };
    const helpTextStyle = {
        fontSize: '0.75rem',
        color: colors.gray500,
        marginTop: '0.25rem',
    };
    // ============================================================================
    // Preview Component
    // ============================================================================
    function renderPreview() {
        const previewHtml = `
      <p><strong>Country:</strong> ${formData.country || '(not set)'}</p>
      ${formData.mainland ? `<p><strong>Mainland:</strong> ${formData.mainland}</p>` : ''}
      ${formData.location ? `<p><strong>City/Location:</strong> ${formData.location}</p>` : ''}
      ${formData.summary ? `<p>${formData.summary}</p>` : ''}
      ${formData.recommendations.filter(a => a.trim()).length > 0
            ? `<h3>recommendations</h3><ul>${formData.recommendations.filter(a => a.trim()).map(a => `<li>${a}</li>`).join('')}</ul>`
            : ''}
    `;
        return (_jsxs("div", { style: sectionStyle, children: [_jsx("h3", { style: sectionTitleStyle, children: " WordPress Export Preview" }), _jsxs("div", { style: {
                        padding: '1rem',
                        backgroundColor: colors.gray50,
                        borderRadius: '8px',
                        border: `1px solid ${colors.gray200}`,
                    }, children: [_jsx("h4", { style: { margin: '0 0 1rem', color: colors.magnusDarkGreen }, children: formData.title || '(No title)' }), _jsx("div", { dangerouslySetInnerHTML: { __html: previewHtml } }), formData.sources.filter(s => s.url.trim()).length > 0 && (_jsxs("div", { style: { marginTop: '1rem', fontSize: '0.875rem' }, children: [_jsx("strong", { children: "Sources:" }), _jsx("ul", { style: { margin: '0.5rem 0 0', paddingLeft: '1.5rem' }, children: formData.sources.filter(s => s.url.trim()).map((s, i) => (_jsx("li", { children: _jsx("a", { href: s.url, target: "_blank", rel: "noopener noreferrer", children: s.title || s.url }) }, i))) })] }))] })] }));
    }
    // ============================================================================
    // Render
    // ============================================================================
    return (_jsxs("div", { style: containerStyle, children: [_jsxs("div", { style: headerStyle, children: [_jsx("h2", { style: titleStyle, children: "Create Alert" }), _jsx("p", { style: subtitleStyle, children: "Create a travel safety alert for WordPress export. All required fields must be completed for a healthy export." })] }), error && (_jsxs("div", { style: errorBoxStyle, children: [_jsx("strong", { children: "Error:" }), " ", error] })), success && (_jsxs("div", { style: successBoxStyle, children: [_jsx("strong", {}), " ", success] })), validation.warnings.length > 0 && (_jsxs("div", { style: warningBoxStyle, children: [_jsx("strong", { children: " Warning:" }), " ", validation.warnings.join('. ')] })), _jsxs("form", { onSubmit: (e) => e.preventDefault(), children: [_jsxs("div", { style: sectionStyle, children: [_jsx("h3", { style: sectionTitleStyle, children: " Basic Information" }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Title ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsx("input", { type: "text", value: formData.title, onChange: e => updateField('title', e.target.value), style: inputStyle, placeholder: "Specific incident title (e.g., 'Armed Clashes in Northern Region')", maxLength: 200 }), _jsx("div", { style: helpTextStyle, children: "Be specific about the incident. Avoid generic titles like \"Travel Advisory\"." })] }), _jsx("div", { style: gridStyle, children: _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Country ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsxs("select", { value: formData.country, onChange: e => updateField('country', e.target.value), style: selectStyle, children: [_jsx("option", { value: "", children: "Select country..." }), COUNTRIES.map(c => (_jsx("option", { value: c, children: c }, c)))] })] }) }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Mainland ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsxs("select", { value: formData.mainland, onChange: e => updateField('mainland', e.target.value), style: selectStyle, children: [_jsx("option", { value: "", children: "Select mainland..." }), _jsx("option", { value: "Africa", children: "Africa" }), _jsx("option", { value: "Antarctica", children: "Antarctica" }), _jsx("option", { value: "Asia", children: "Asia" }), _jsx("option", { value: "Europe", children: "Europe" }), _jsx("option", { value: "North America", children: "North America" }), _jsx("option", { value: "Australia (Oceania)", children: "Australia (Oceania)" }), _jsx("option", { value: "South America", children: "South America" })] })] }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["City/Location ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsx("input", { type: "text", value: formData.location, onChange: e => updateField('location', e.target.value), style: inputStyle, placeholder: "Specific location (e.g., 'Tel Aviv', 'Haifa', 'Jerusalem')" })] }), _jsxs("div", { style: gridStyle, children: [_jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Severity ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsx("select", { value: formData.severity, onChange: e => updateField('severity', e.target.value), style: {
                                                    ...selectStyle,
                                                    borderLeftWidth: '4px',
                                                    borderLeftColor: SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.color,
                                                }, children: SEVERITY_OPTIONS.map(opt => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }), _jsx("div", { style: helpTextStyle, children: SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.description })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Event Type" }), _jsxs("select", { value: formData.event_type, onChange: e => updateField('event_type', e.target.value), style: selectStyle, children: [_jsx("option", { value: "", children: "Select type..." }), EVENT_TYPES.map(t => (_jsx("option", { value: t, children: t }, t)))] })] })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("h3", { style: sectionTitleStyle, children: " Content" }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Summary ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsx("textarea", { value: formData.summary, onChange: e => updateField('summary', e.target.value), style: textareaStyle, placeholder: "2-3 sentences describing the incident. Be concrete about what happened and where. Keep under 150 words.", maxLength: 800 }), _jsxs("div", { style: helpTextStyle, children: [formData.summary.length, "/800 characters. Aim for 50-150 words."] })] }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["recommendations ", _jsx("span", { style: requiredStyle, children: "*" }), " (minimum 2 items)"] }), formData.recommendations.map((item, index) => (_jsxs("div", { style: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }, children: [_jsx("input", { type: "text", value: item, onChange: e => updateAdvice(index, e.target.value), style: { ...inputStyle, flex: 1 }, placeholder: `recommendations item ${index + 1} (e.g., "Avoid the affected area")` }), formData.recommendations.length > 2 && (_jsx("button", { type: "button", onClick: () => removeAdvice(index), style: {
                                                    padding: '0.5rem 0.75rem',
                                                    backgroundColor: colors.red100,
                                                    color: colors.red600,
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                } }))] }, index))), formData.recommendations.length < 8 && (_jsx("button", { type: "button", onClick: addAdvice, style: {
                                            ...buttons.secondary,
                                            marginTop: '0.5rem',
                                        }, children: "+ Add recommendations" })), _jsx("div", { style: helpTextStyle, children: "4-6 practical bullet points recommended for WordPress export." })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("h3", { style: sectionTitleStyle, children: " Sources" }), formData.sources.map((source, index) => (_jsxs("div", { style: {
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr auto',
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem',
                                    alignItems: 'start',
                                }, children: [_jsx("div", { children: _jsx("input", { type: "url", value: source.url, onChange: e => updateSource(index, 'url', e.target.value), style: inputStyle, placeholder: "https://..." }) }), _jsx("div", { children: _jsx("input", { type: "text", value: source.title || '', onChange: e => updateSource(index, 'title', e.target.value), style: inputStyle, placeholder: "Source title (optional)" }) }), formData.sources.length > 1 && (_jsx("button", { type: "button", onClick: () => removeSource(index), style: {
                                            padding: '0.75rem',
                                            backgroundColor: colors.red100,
                                            color: colors.red600,
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                        } }))] }, index))), formData.sources.length < 3 && (_jsx("button", { type: "button", onClick: addSource, style: {
                                    ...buttons.secondary,
                                    marginTop: '0.5rem',
                                }, children: "+ Add Source" })), _jsx("div", { style: helpTextStyle, children: "1-3 source URLs recommended. These will be included in the WordPress export." })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("h3", { style: sectionTitleStyle, children: "\uD83D\uDDFA Geographic Data" }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["GeoJSON ", _jsx("span", { style: requiredStyle, children: "*" })] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }, children: [_jsx("button", { type: "button", style: { ...buttons.secondary, padding: '6px 12px', fontSize: 13 }, onClick: () => setShowGeoModal(true), children: "Open GeoJSON Generator" }), _jsx("span", { style: { fontSize: 12, color: '#888' }, children: "Draw polygon, copy, and paste below" })] }), _jsx("textarea", { value: formData.geoJSON, onChange: e => updateField('geoJSON', e.target.value), style: {
                                            ...textareaStyle,
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                        }, placeholder: '{\n  "type": "Feature",\n  "geometry": {\n    "type": "Point",\n    "coordinates": [35.2137, 31.7683]\n  },\n  "properties": {}\n}', rows: 8 }), _jsxs("div", { style: helpTextStyle, children: [_jsx("strong", { children: "Required." }), " Valid GeoJSON object (Polygon/FeatureCollection for ACF). Use the generator for easy drawing."] })] }), showGeoModal && (_jsx(GeoJSONGeneratorModal, { mapboxToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example', onClose: () => setShowGeoModal(false) })), _jsxs("div", { style: gridStyle, children: [_jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Geo Scope ", _jsx("span", { style: { fontSize: '0.85rem', color: colors.gray500 }, children: "(optional)" })] }), _jsx("select", { value: formData.geo_scope, onChange: e => updateField('geo_scope', e.target.value), style: selectStyle, children: GEO_SCOPES.map(s => (_jsx("option", { value: s, children: s }, s))) })] }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Latitude ", _jsx("span", { style: { fontSize: '0.85rem', color: colors.gray500 }, children: "(optional)" })] }), _jsx("input", { type: "number", step: "any", value: formData.latitude, onChange: e => updateField('latitude', e.target.value), style: inputStyle, placeholder: "e.g., 31.7683", min: "-90", max: "90" })] }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Longitude ", _jsx("span", { style: { fontSize: '0.85rem', color: colors.gray500 }, children: "(optional)" })] }), _jsx("input", { type: "number", step: "any", value: formData.longitude, onChange: e => updateField('longitude', e.target.value), style: inputStyle, placeholder: "e.g., 35.2137", min: "-180", max: "180" })] }), _jsxs("div", { style: fieldStyle, children: [_jsxs("label", { style: labelStyle, children: ["Radius (km) ", _jsx("span", { style: { fontSize: '0.85rem', color: colors.gray500 }, children: "(optional)" })] }), _jsx("input", { type: "number", value: formData.radius_km, onChange: e => updateField('radius_km', e.target.value), style: inputStyle, placeholder: "25", min: "1", max: "1000" })] })] })] }), _jsxs("div", { style: sectionStyle, children: [_jsx("h3", { style: sectionTitleStyle, children: " Event Dates (Optional)" }), _jsxs("div", { style: gridStyle, children: [_jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Event Start" }), _jsx("input", { type: "datetime-local", value: formData.event_start_date, onChange: e => updateField('event_start_date', e.target.value), style: inputStyle })] }), _jsxs("div", { style: fieldStyle, children: [_jsx("label", { style: labelStyle, children: "Event End" }), _jsx("input", { type: "datetime-local", value: formData.event_end_date, onChange: e => updateField('event_end_date', e.target.value), style: inputStyle })] })] })] }), showPreview && renderPreview(), _jsx("div", { style: actionsStyle, children: _jsx("button", { type: "button", onClick: () => setShowPreview(!showPreview), style: buttons.secondary, children: showPreview ? 'Hide Preview' : 'Show WP Preview' }) }), _jsxs("div", { style: {
                            display: 'flex',
                            gap: '0.75rem',
                            justifyContent: 'space-between',
                            marginTop: '1.5rem',
                            paddingTop: '1.5rem',
                            borderTop: `2px solid ${colors.gray200}`
                        }, children: [_jsx("div", { style: { display: 'flex', gap: '0.75rem' }, children: _jsx("button", { type: "button", onClick: handleDiscard, disabled: submitting, style: {
                                        ...buttons.secondary,
                                        backgroundColor: colors.red50,
                                        color: colors.red700,
                                        border: `1px solid ${colors.red200}`,
                                        opacity: submitting ? 0.6 : 1,
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                    }, children: "Discard" }) }), _jsxs("div", { style: { display: 'flex', gap: '0.75rem' }, children: [_jsx("button", { type: "button", onClick: handleSaveDraft, disabled: submitting || !validation.isValid, style: {
                                            ...buttons.secondary,
                                            opacity: (submitting || !validation.isValid) ? 0.6 : 1,
                                            cursor: (submitting || !validation.isValid) ? 'not-allowed' : 'pointer',
                                        }, children: submitting ? 'Saving...' : 'Save Draft' }), _jsx("button", { type: "button", onClick: handlePostAndCopy, disabled: submitting || !validation.isValid, style: {
                                            ...buttons.primary,
                                            opacity: (submitting || !validation.isValid) ? 0.6 : 1,
                                            cursor: (submitting || !validation.isValid) ? 'not-allowed' : 'pointer',
                                        }, children: submitting ? 'Posting...' : 'Post to WordPress (+ Copy WhatsApp)' })] })] }), !validation.isValid && (_jsxs("div", { style: { marginTop: '1rem', fontSize: '0.875rem', color: colors.red600 }, children: [_jsx("strong", { children: "Please fix:" }), _jsx("ul", { style: { margin: '0.5rem 0 0', paddingLeft: '1.5rem' }, children: validation.errors.map((err, i) => (_jsx("li", { children: err }, i))) })] }))] })] }));
}
// Named export for flexibility
export { AlertCreateInline };
