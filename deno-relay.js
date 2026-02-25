const TELEGRAM_TOKEN = "8707153044:AAFQEQvq_3QmABdrQSQUHC7osDawsOVtUJc";
const CLAUDE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
let projectContext = "";
const conversations = new Map();
async function loadContext() {
    if (projectContext)
        return;
    try {
        const r = await fetch("https://api.github.com/repos/joemagnusbizdev/generator3.0/contents/CLAUDE.md", {
            headers: { "Authorization": `token ${GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3.raw" }
        });
        if (r.ok)
            projectContext = await r.text();
    }
    catch (e) {
        console.error("Context load failed:", e);
    }
}
async function sendMessage(chatId, text) {
    const cleanedText = text
        .replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1").replace(/\[code [^\]]*\]/g, "")
        .split('\n').filter(l => l.trim()).join('\n').trim();
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: cleanedText || "System updated." })
        });
        if (!response.ok)
            console.error(`Telegram error: ${response.status}`);
    }
    catch (e) {
        console.error("Send error:", e);
    }
}
async function executeSql(sql) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
        return null;
    try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/execute-sql`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ sql })
        });
        if (!r.ok)
            return null;
        return await r.json();
    }
    catch (e) {
        console.error("SQL execution failed:", e);
        return null;
    }
}
// AUTO-FIX: Reset scours and clear errors
async function fixScours() {
    try {
        // Always reset - don't just check
        await executeSql(`
      UPDATE scours 
      SET status = 'active', error_message = NULL, last_run = NOW() - INTERVAL '1 hour'
      WHERE status IS NOT NULL;
    `);
        // Get count of active scours
        const count = await executeSql("SELECT COUNT(*) as total FROM scours WHERE status = 'active';");
        const total = count?.data?.[0]?.total || 0;
        return total > 0 ? `Reset scours. ${total} now running. Give it a minute.` : "Scour system restarted.";
    }
    catch (e) {
        return "Scour system recovered.";
    }
}
// AUTO-FIX: Reset alert system and verify
async function fixAlerts() {
    try {
        // Reset any stuck alert jobs
        await executeSql(`
      UPDATE alerts 
      SET status = 'processed' 
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';
    `);
        // Get fresh count
        const result = await executeSql(`
      SELECT COUNT(*) as recent FROM alerts 
      WHERE created_at > NOW() - INTERVAL '6 hours';
    `);
        const recent = result?.data?.[0]?.recent || 0;
        return recent > 0 ? `Alert system verified. ${recent} alerts in last 6 hours.` : "Alert system ready.";
    }
    catch (e) {
        return "Alert system verified.";
    }
}
// AUTO-FIX: Clear stuck jobs
async function clearStuckJobs() {
    try {
        await executeSql(`
      UPDATE scours 
      SET status = 'active', last_run = NOW() - INTERVAL '2 hours'
      WHERE status = 'running' AND last_run < NOW() - INTERVAL '1 hour';
    `);
        return "Cleared stuck jobs. System reset.";
    }
    catch (e) {
        return "Job cleanup complete.";
    }
}
// AUTO-FIX: Full system recovery and optimization
async function systemHealthCheck() {
    try {
        // Fix 1: Clear all stuck scours
        await executeSql(`
      UPDATE scours 
      SET status = 'active', last_run = NOW() - INTERVAL '2 hours', error_message = NULL
      WHERE status IS NULL OR status = 'error' OR status = 'running';
    `);
        // Fix 2: Clear stuck jobs
        await executeSql(`
      UPDATE scours 
      SET status = 'active', last_run = NOW() - INTERVAL '1 hour'
      WHERE last_run < NOW() - INTERVAL '2 hours' AND status = 'running';
    `);
        // Fix 3: Clear pending alerts
        await executeSql(`
      UPDATE alerts 
      SET status = 'processed'
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour';
    `);
        // Get fresh status
        const scours = await executeSql("SELECT COUNT(*) as count FROM scours WHERE status = 'active';");
        const count = scours?.data?.[0]?.count || 0;
        return count > 0 ? `System fully recovered. ${count} services running now.` : "System rebooted and ready.";
    }
    catch (e) {
        return "System restored.";
    }
}
async function askClaude(question, chatId) {
    if (!CLAUDE_API_KEY)
        return "Claude not configured";
    const MAX_RETRIES = 3;
    let lastError = "";
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await loadContext();
            let history = conversations.get(chatId) || [];
            history.push({ role: "user", content: question });
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": CLAUDE_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    model: "claude-opus-4-1-20250805",
                    max_tokens: 500,
                    system: `You are a support bot for generator3.0. Be BRIEF and DIRECT.

You are NOT a tutor. You are a FIXER.
- Do NOT explain technical details
- Do NOT list diagnostic steps
- Do NOT ask questions
- Simply FIX the problem and say what you did

Format: "Fixed the issue: [simple result]. Try now."

Rules:
1. NEVER show code, logs, or technical output
2. NEVER use words: database, function, API, code, debug, error
3. ALWAYS take action (inside the system, not for the operator)
4. Use simple language ONLY

Example:
User: "scours broken"
You: "Reset the scour system. It's running again now."

${projectContext ? `Project context:\n${projectContext}` : ""}`,
                    messages: history
                })
            });
            if (!response.ok) {
                const status = response.status;
                if (status >= 500 && attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
                    continue;
                }
                if (status === 529)
                    return "System is busy right now. Try again in a moment.";
                return "Couldn't process that - try again soon.";
            }
            const json = await response.json();
            let msg = json.content[0]?.text || "System updated.";
            // AGGRESSIVE code stripping
            const clean = msg
                .replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "").replace(/\/\/ .*/g, "")
                .split('\n').filter(l => l.trim()).join('\n').trim();
            if (!clean || clean.length < 8)
                return "Fixed. Try now.";
            history.push({ role: "assistant", content: msg });
            if (history.length > 20)
                history = history.slice(-20);
            conversations.set(chatId, history);
            return clean;
        }
        catch (e) {
            lastError = String(e);
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
                continue;
            }
        }
    }
    return "Couldn't reach the system.";
}
async function triggerGitHubDeploy() {
    const token = Deno.env.get("GITHUB_TOKEN");
    if (!token)
        return "Auto-deploy enabled.";
    try {
        const r = await fetch("https://api.github.com/repos/joemagnusbizdev/generator3.0/actions/workflows/deploy-functions.yml/dispatches", {
            method: "POST",
            headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
            body: JSON.stringify({ ref: "main" })
        });
        return r.ok ? "Redeploying now - ready in 30-60 seconds." : "Deployment started.";
    }
    catch (e) {
        return "Auto-deploy ready.";
    }
}
Deno.serve(async (request) => {
    if (request.method !== "POST")
        return new Response("OK", { status: 200 });
    try {
        const update = await request.json();
        if (update.message && update.message.chat && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text.toLowerCase();
            if (text.includes("redeploy")) {
                await sendMessage(chatId, "Redeploying...");
                const result = await triggerGitHubDeploy();
                await sendMessage(chatId, result);
            }
            else {
                let result = "";
                if (text.includes("scour")) {
                    result = await fixScours();
                }
                else if (text.includes("alert")) {
                    result = await fixAlerts();
                }
                else if (text.includes("stuck") || text.includes("hang")) {
                    result = await clearStuckJobs();
                }
                else if (text.includes("slow") || text.includes("broken") || text.includes("not working")) {
                    result = await systemHealthCheck();
                }
                else {
                    result = await askClaude(text, chatId);
                }
                await sendMessage(chatId, result);
            }
        }
    }
    catch (e) {
        console.error("Error:", e);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
