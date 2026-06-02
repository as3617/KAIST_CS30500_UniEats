import * as stringSimilarity from 'string-similarity';
import { MenuServing } from '../menu-servings/schemas/menu-serving.schema';

/**
 * Extracts a date from OCR raw text. 
 * Looks for patterns like YYYY-MM-DD, YYYY/MM/DD, or YYYY년 MM월 DD일.
 * Returns the date in YYYY-MM-DD format, or null if no valid date is found.
 */
export function extractDate(rawText: string): string | null {
  // Regex to match dates in various formats
  // e.g. 2026-06-01, 2026.06.01, 2026/06/01, 2026년 06월 01일
  const dateRegex = /(\d{4})[-\/\.년\s]+(\d{1,2})[-\/\.월\s]+(\d{1,2})[일]?/;
  const match = rawText.match(dateRegex);

  if (!match) {
    return null;
  }

  const year = match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');

  // Simple validation to prevent impossible dates (e.g., month 99)
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

/**
 * Computes the Levenshtein edit distance between two strings.
 * Used for precise character-level fuzzy matching of OCR labels.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Extracts an approval number (승인번호) from OCR raw text.
 * Uses a combination of Levenshtein fuzzing and strict 8-digit format constraints.
 */
export function extractApprovalNumber(rawText: string): string | null {
  const normalizedRaw = (rawText || '').replace(/\s+/g, '');
  const targetLabel = "승인번호";
  
  // Find all occurrences of 8 digits, capturing the preceding 10 characters
  // Approval numbers in Korea are almost exclusively 8 digits.
  const regex = /([^0-9]{1,10})([0-9]{8})(?![0-9])/g;
  let match;
  
  let bestDistance = Infinity;
  let bestApprovalNumber: string | null = null;

  while ((match = regex.exec(normalizedRaw)) !== null) {
    const precedingText = match[1];
    const number = match[2];
    
    // Filter out numbers that look like dates (e.g. 20260601)
    const looksLikeDate = number.startsWith('202') && 
                          parseInt(number.substring(4, 6)) >= 1 && 
                          parseInt(number.substring(4, 6)) <= 12 &&
                          parseInt(number.substring(6, 8)) >= 1 &&
                          parseInt(number.substring(6, 8)) <= 31;
    if (looksLikeDate) continue;

    // Clean the preceding text to only leave Korean characters, removing symbols like ':' or '-'
    const cleanPreceding = precedingText.replace(/[^가-힣]/g, '');
    
    // Compare up to the last 4 characters of the preceding text to our target "승인번호"
    const labelToCompare = cleanPreceding.slice(-4);
    const distance = levenshteinDistance(labelToCompare, targetLabel);

    // Prevent false positives from "주문번호" (Order Number) which might have a close distance
    if (cleanPreceding.includes("주문")) continue;

    // Allow up to 3 character edits (e.g., "숭민면호" -> 3 edits).
    // Using <= bestDistance ensures that if there's a tie, we take the one appearing LAST,
    // which correctly matches the layout of Korean receipts (approval number at the bottom).
    if (distance <= bestDistance && distance <= 3) {
      bestDistance = distance;
      bestApprovalNumber = number;
    }
  }

  return bestApprovalNumber;
}

/**
 * Normalizes text for better fuzzy matching by removing all whitespace and standardizing casing.
 */
function normalizeText(text: string): string {
  return (text || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * Matches the raw receipt text against a list of MenuServings.
 * Uses Sørensen-Dice coefficient (string-similarity) to find the best match.
 * Returns the matched MenuServing and its score, or null if below threshold.
 */
export function matchMenu(
  rawText: string,
  servings: any[],
  threshold = 0.5
): { match: any; score: number } | null {
  if (!rawText || !servings || servings.length === 0) {
    return null;
  }

  const normalizedRaw = normalizeText(rawText);

  let bestMatch: any = null;
  let highestScore = 0;

  for (const serving of servings) {
    // Assuming populatedName has already been called or mealId has name populated
    const mealName = typeof serving.mealId === 'object' ? serving.mealId.name : serving.mealId;
    if (!mealName) continue;

    const normalizedMenu = normalizeText(mealName);

    // If the receipt contains the exact normalized menu name, it's a perfect match
    if (normalizedRaw.includes(normalizedMenu)) {
      return { match: serving, score: 1.0 };
    }

    // Otherwise, we break the raw text into chunks (the size of the menu name)
    // and slide across the receipt text to find the highest similarity substring.
    // This is because comparing a short menu name to a massive receipt string directly yields a low score.
    const windowSize = normalizedMenu.length;
    let localBestScore = 0;

    for (let i = 0; i <= normalizedRaw.length - windowSize; i++) {
      const windowText = normalizedRaw.substring(i, i + windowSize);
      const score = stringSimilarity.compareTwoStrings(windowText, normalizedMenu);
      if (score > localBestScore) {
        localBestScore = score;
      }
    }

    if (localBestScore > highestScore) {
      highestScore = localBestScore;
      bestMatch = serving;
    }
  }

  if (highestScore >= threshold && bestMatch) {
    return { match: bestMatch, score: highestScore };
  }

  return null;
}
