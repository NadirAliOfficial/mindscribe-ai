// Typo detection rules — mirrors content.js typoScore()
// Run: node test_typoscore.js

function typoScore(text) {
  let score = 0;
  const fired = [];
  const words = text.trim().split(/\s+/);
  const lowerLetters = w => w.replace(/[^a-z]/g, "");

  // 1. Word with 2+ chars, all consonants (no vowels) — "teh", "whn", "kj"
  if (words.some(w => { const l = lowerLetters(w); return l.length >= 2 && !/[aeiou]/.test(l); }))
    { score++; fired.push("1-no-vowels"); }

  // 2. Missing apostrophe in contractions — "dont", "cant", "isnt", "Im" etc.
  if (/\b(dont|cant|wont|isnt|wasnt|arent|werent|didnt|doesnt|hadnt|havent|hasnt|shouldnt|wouldnt|couldnt|Im|Ive|Ill)\b/.test(text))
    { score++; fired.push("2-missing-apostrophe"); }

  // 3. Common misspellings
  if (/\b(recieve|definately|seperate|occured|beleive|wierd|freind|occassion|untill|alot|probaly|becuase|enviroment|accomodate|independant|tomarrow|tommorrow|acheive|arguement|concious|decieve|existance|maintainance|occurance|writting)\b/i.test(text))
    { score++; fired.push("3-misspelling"); }

  // 4. Wrong article — "a apple", "a orange", "an car", "an book"
  if (/\ba [aeiou]/i.test(text) || /\ban [^aeiou\s]/i.test(text))
    { score++; fired.push("4-wrong-article"); }

  // 5. Wrong verb form — "have went", "should of", "would of", "could of"
  if (/\b(have went|has went|had went|should of|would of|could of|must of|might of)\b/i.test(text))
    { score++; fired.push("5-wrong-verb-form"); }

  // 6. "Me and" at start of sentence (should be "I and …" or restructure)
  if (/^Me and\b/i.test(text.trim()))
    { score++; fired.push("6-me-and-start"); }

  // 7. First character is lowercase — missing capitalisation
  if (/^[a-z]/.test(text.trimStart()))
    { score++; fired.push("7-lowercase-start"); }

  // 8. Standalone lowercase "i" used as pronoun — "i think", "can i help"
  if (/\bi\b/.test(text))
    { score++; fired.push("8-lowercase-i"); }

  // 9. Space before punctuation — "sir .", "hello ,"
  if (/\s[.!?,;]/.test(text))
    { score++; fired.push("9-space-before-punct"); }

  // 10. Punctuation immediately followed by letter, no space — "hello.World", "ok,go"
  if (/[.!?,;][A-Za-z]/.test(text))
    { score++; fired.push("10-no-space-after-punct"); }

  // 11. Three or more of the same letter in a row — "coool", "heyyyy"
  if (/([a-zA-Z])\1{2,}/.test(text))
    { score++; fired.push("11-triple-letter"); }

  // 12. Double space
  if (/  /.test(text))
    { score++; fired.push("12-double-space"); }

  // 13. Five or more words with zero punctuation — almost certainly needs proofreading
  if (words.length >= 5 && !/[.!?,;]/.test(text))
    { score++; fired.push("13-no-punctuation"); }

  // 14. Repeated word back-to-back — "the the", "I I"
  if (/\b(\w+)\s+\1\b/i.test(text))
    { score++; fired.push("14-repeated-word"); }

  // 15. Word of 5+ letters whose vowel ratio is below 20% — "strngth", "thnks"
  if (words.some(w => {
    const l = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
    return l.length >= 5 && (l.match(/[aeiou]/g) || []).length / l.length < 0.2;
  })) { score++; fired.push("15-low-vowel-ratio"); }

  return { score, fired };
}

const tests = [
  // Common Fiverr/chat typing — should trigger
  { text: "Hello there I am here to help you brother",          expect: true  },
  { text: "I m here sir . how can i help you.",                 expect: true  },
  { text: "dont worry about it i will handle everything",       expect: true  },
  { text: "I have went to the store yesterday",                 expect: true  },
  { text: "a apple a day keeps the doctor away",                expect: true  },
  { text: "heyyy brother whats up",                             expect: true  },
  { text: "she dont like that attitude at all",                 expect: true  },
  { text: "could of done this yesterday but didnt",             expect: true  },
  { text: "The video is ready .please review and let me know",  expect: true  },
  { text: "i think we should meet and discuss the project soon",expect: true  },
  { text: "recieve the package and confirm",                    expect: true  },
  { text: "thnks bro will chek it out soon",                   expect: true  },
  { text: "Me and John completed the work yesterday",           expect: true  },
  { text: "the  file is attached  please check",               expect: true  },
  { text: "can i help you with the project details sir",        expect: true  },

  // Correct text — should NOT trigger (false positive check)
  { text: "I'm here to help you with your project.",           expect: false },
  { text: "Perfect sentence with proper grammar.",             expect: false },
  { text: "Let me know if you have any questions.",            expect: false },
  { text: "The delivery is scheduled for tomorrow.",           expect: false },
  { text: "Thank you for your patience.",                      expect: false },
];

console.log("\n" + "─".repeat(72));
console.log(" TYPO DETECTION TEST — " + tests.length + " phrases");
console.log("─".repeat(72));

let passed = 0, failed = 0;

tests.forEach((tc, i) => {
  const { score, fired } = typoScore(tc.text);
  const triggers = score > 0;
  const ok = triggers === tc.expect;
  if (ok) passed++; else failed++;

  const icon   = ok ? "✓" : "✗";
  const result = triggers ? `TRIGGER [${score}]` : "skip    [0]";
  console.log(`\n${icon} ${String(i+1).padStart(2)}. ${result}`);
  console.log(`      "${tc.text}"`);
  if (fired.length) console.log(`      rules: ${fired.join(", ")}`);
  if (!ok) console.log(`      !! expected ${tc.expect ? "TRIGGER" : "skip"}`);
});

console.log("\n" + "─".repeat(72));
console.log(` ${tests.length} tests — ${passed} passed, ${failed} failed`);
console.log("─".repeat(72) + "\n");
if (failed > 0) process.exit(1);
