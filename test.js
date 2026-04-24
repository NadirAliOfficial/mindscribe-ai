// Unit tests for Smart Reply pure functions
// Run: node test.js

// ── Copy of the functions under test (keep in sync with content.js) ───────────

function detectSituation(chatMsgs) {
  const themMsgs = chatMsgs.filter(m => m.role === "them");
  const lastThem = themMsgs[themMsgs.length - 1]?.content?.toLowerCase() || "";
  const allThem  = themMsgs.map(m => m.content.toLowerCase()).join(" ");

  if (/refund|scam|fake|report|fraud|unacceptable|terrible|awful|worst/.test(lastThem))                    return "complaint";
  if (/revise|revision|change|modify|redo|not quite|not right|different|adjust/.test(lastThem))             return "revision";
  if (/still waiting|still haven|haven't received|where is my|where.s my|delayed|running late|overdue/.test(lastThem)) return "delay_complaint";
  if (/not working|error|bug|broken|crash|doesn't work|doesn.t work/.test(lastThem))                       return "support";
  if (/price|cost|budget|discount|cheaper|how much|rate|fee|charge/.test(lastThem))                        return "pricing";
  if (/\bwhen (will|can|do|is|are|should|could)\b|deadline|urgent|asap|how long|how many days|delivery date|timeline/.test(lastThem)) return "timeline";
  if (/thank|great|perfect|amazing|love it|awesome|excellent|well done|good job/.test(lastThem))            return "praise";
  if (/\bhold\b|get back to you|get back to me|let me think|i'll think|will think|need time|think about it/.test(lastThem)) return "hold";
  if (themMsgs.length <= 2)                                                                                 return "new_inquiry";
  if (/order|delivery|milestone|phase|submitted|progress|update/.test(allThem))                             return "active_order";
  return "general";
}

function extractIntent(chatMsgs) {
  const lastThem = chatMsgs.filter(m => m.role === "them").pop()?.content || "";
  const lo = lastThem.toLowerCase();
  const intents = [];
  if (/\?/.test(lastThem))                                           intents.push("asking a question");
  if (/price|cost|budget|how much/.test(lo))                         intents.push("pricing inquiry");
  if (/when|how long|deadline|timeline|deliver/.test(lo))            intents.push("timeline inquiry");
  if (/send|share|show|provide|attach|give me/.test(lo))             intents.push("requesting files or info");
  if (/example|sample|portfolio|past work|similar work/.test(lo))    intents.push("asking for examples");
  if (/revise|change|update|fix|redo|adjust/.test(lo))               intents.push("revision request");
  if (/can you|could you|please|would you/.test(lo))                 intents.push("making a request");
  return intents.join(", ") || "general message";
}

function analyzeTone(chatMsgs) {
  const themMsgs = chatMsgs.filter(m => m.role === "them").slice(-5);
  if (!themMsgs.length) return "";
  const allText = themMsgs.map(m => m.content).join(" ");
  const words   = allText.split(/\s+/).filter(Boolean);
  const sents   = allText.split(/[.!?]+/).filter(s => s.trim().length > 2);
  const avgLen  = sents.length ? words.length / sents.length : 10;
  const informal = /\b(hey|hi|lol|btw|fyi|gonna|wanna|yeah|yep|ok|okay|thx|ur\b|u |r )\b/i.test(allText);
  const formal   = /\b(dear|sincerely|regards|respectfully|pursuant|hereby|kindly)\b/i.test(allText);
  const emojis   = /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]/u.test(allText);
  const notes    = [];
  if (formal)        notes.push("formal and professional");
  else if (informal) notes.push("casual and informal");
  if (avgLen < 7)    notes.push("brief short sentences");
  if (emojis)        notes.push("uses emojis");
  return notes.length ? `Mirror the client's style: they write in a ${notes.join(", ")} way.` : "";
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function t(label, got, expected) {
  if (got === expected) { console.log(`  ✓  ${label}`); passed++; }
  else {
    console.error(`  ✗  ${label}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       got:      ${JSON.stringify(got)}`);
    failed++;
  }
}

function them(c) { return { role: "them", content: c }; }
function me(c)   { return { role: "me",   content: c }; }

// ── detectSituation ───────────────────────────────────────────────────────────
console.log("\ndetectSituation — happy path:");

t("refund → complaint",              detectSituation([them("I want a refund, this is unacceptable")]),                        "complaint");
t("scam → complaint",                detectSituation([them("this is a scam, I will report you")]),                            "complaint");
t("revise → revision",               detectSituation([them("please revise the colors in the logo")]),                         "revision");
t("not quite → revision",            detectSituation([them("it's not quite what I had in mind")]),                            "revision");
t("modify → revision",               detectSituation([them("can you modify the header font?")]),                              "revision");
t("still waiting → delay_complaint", detectSituation([them("I'm still waiting, where is my delivery?")]),                     "delay_complaint");
t("running late → delay_complaint",  detectSituation([them("the project is running late, this is not ok")]),                  "delay_complaint");
t("overdue → delay_complaint",       detectSituation([them("this is overdue, I needed it yesterday")]),                       "delay_complaint");
t("not working → support",           detectSituation([them("the bot is not working, I keep getting errors")]),                "support");
t("bug → support",                   detectSituation([them("there is a bug in the code")]),                                   "support");
t("broken → support",                detectSituation([them("the login page is broken")]),                                     "support");
t("how much → pricing",              detectSituation([them("how much does it cost to build this?")]),                         "pricing");
t("budget → pricing",                detectSituation([them("my budget is $200, can you do it?")]),                            "pricing");
t("when will → timeline",            detectSituation([them("when will you deliver this?")]),                                  "timeline");
t("asap → timeline",                 detectSituation([them("I need this asap")]),                                             "timeline");
t("deadline → timeline",             detectSituation([them("what is the deadline for this?")]),                               "timeline");
t("thank → praise",                  detectSituation([them("thank you so much, the work is perfect!")]),                      "praise");
t("amazing → praise",                detectSituation([them("the result is amazing, love it!")]),                              "praise");
t("first msg → new_inquiry",         detectSituation([them("hi, I need a chatbot for my website")]),                          "new_inquiry");
t("2 msgs → new_inquiry",            detectSituation([them("hi"), them("can you help me?")]),                                 "new_inquiry");
t("active_order via allThem",        detectSituation([them("hi"), them("ok"), them("ok"), them("can you give me an order update?")]), "active_order");
t("empty → new_inquiry",             detectSituation([]),                                                                     "new_inquiry");
t("only me msgs → new_inquiry",      detectSituation([me("hello"), me("how are you")]),                                       "new_inquiry");

console.log("\ndetectSituation — priority & edge cases:");

t("refund beats update (priority)",  detectSituation([them("I want a refund, please update me")]),             "complaint");
t("'update' alone = active_order",   detectSituation([them("hi"), them("hi"), them("hi"), them("any update?")]), "active_order");
t("'when I' casual ≠ timeline",      detectSituation([them("when I checked earlier it looked different")]),     "revision"); // "different" → revision
t("'getting late' ≠ delay_complaint",detectSituation([them("it's getting late, let's talk tomorrow")]),        "new_inquiry"); // single msg → new_inquiry, not delay_complaint
t("'issue is deadline' ≠ support",   detectSituation([them("the issue is I need it by Friday asap")]),         "timeline"); // FIXED: "asap" → timeline
t("'when can' = timeline",           detectSituation([them("when can you start?")]),                           "timeline");
t("'when do' = timeline",            detectSituation([them("when do you think it'll be ready?")]),             "timeline");
t("'when I' alone = general/other",  detectSituation([them("when I looked at it, the colors seemed off"), them("please change them")]), "revision");
t("hold → hold",          detectSituation([them("ok"), them("hold"), them("I will get back to you")]), "hold");
t("get back → hold",      detectSituation([them("ok"), them("ok"), them("I will get back to you")]), "hold");
t("need time → hold",     detectSituation([them("ok"), them("ok"), them("I need time to think about it")]), "hold");

// ── extractIntent ─────────────────────────────────────────────────────────────
console.log("\nextractIntent:");

t("pricing ?",          extractIntent([them("how much does this cost?")]),                        "asking a question, pricing inquiry");
t("timeline ?",         extractIntent([them("when will you deliver?")]),                          "asking a question, timeline inquiry");
t("share request",      extractIntent([them("can you share the source files?")]),                 "asking a question, requesting files or info, making a request");
t("show examples",      extractIntent([them("can you show me some examples of past work?")]),     "asking a question, requesting files or info, asking for examples, making a request");
t("fix color",          extractIntent([them("please fix the button color")]),                     "revision request, making a request");
t("plain statement",    extractIntent([them("I will think about it")]),                          "general message");
t("no them msgs",       extractIntent([me("hello")]),                                            "general message");
t("update+price",       extractIntent([them("can you update the design and tell me the price?")]), "asking a question, pricing inquiry, revision request, making a request");

// ── analyzeTone ───────────────────────────────────────────────────────────────
console.log("\nanalyzeTone:");

t("no them → empty",      analyzeTone([me("hello")]),    "");
t("empty → empty",        analyzeTone([]),               "");

// formal — use longer sentences to avoid avgLen < 7 false positive
t("formal long sentences",
  analyzeTone([them("Dear sir, I am writing to formally request a comprehensive revision of the delivered work. Kindly acknowledge receipt at your earliest convenience.")]),
  "Mirror the client's style: they write in a formal and professional way.");

t("casual short",
  analyzeTone([them("hey"), them("yeah ok"), them("thx")]),
  "Mirror the client's style: they write in a casual and informal, brief short sentences way.");

t("neutral — no note",
  analyzeTone([them("I would like to discuss the project scope and timeline requirements in more detail with you.")]),
  "");

t("emoji detected",
  analyzeTone([them("looks great 😊 thank you!")]).includes("uses emojis"),
  true);

t("formal + short triggers both flags",
  analyzeTone([them("Dear sir. Kindly advise.")]).includes("formal and professional"),
  true);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
