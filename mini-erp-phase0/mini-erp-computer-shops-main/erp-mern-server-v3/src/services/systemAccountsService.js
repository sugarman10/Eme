import Account from '../models/Account.js';
import { STANDARD_CHART_OF_ACCOUNTS, SYSTEM_ACCOUNT_KEYS } from '../config/chartOfAccounts.js';
import logger from '../config/logger.js';

/**
 * Ensure Standard Chart of Accounts exists in database with proper parent-child hierarchy
 */
export async function ensureStandardChartOfAccounts() {
  try {
    const codeToIdMap = new Map();

    // 1. First pass: ensure all accounts exist
    for (const item of STANDARD_CHART_OF_ACCOUNTS) {
      let doc = await Account.findOne({ code: item.code });

      // If not found by primary code, check if a legacy account exists
      if (!doc && item.legacyCodes && item.legacyCodes.length > 0) {
        doc = await Account.findOne({ code: { $in: item.legacyCodes } });
      }

      if (!doc) {
        doc = await Account.create({
          code: item.code,
          name: item.name,
          type: item.type,
          isSystem: true,
          isActive: true,
          description: `حساب نظام أساسي (${item.systemKey || item.code})`,
        });
        logger.info(`✅ [COA] Created system account: ${item.code} - ${item.name}`);
      } else {
        // Ensure system flag is locked
        let updated = false;
        if (!doc.isSystem) {
          doc.isSystem = true;
          updated = true;
        }
        if (!doc.isActive) {
          doc.isActive = true;
          updated = true;
        }
        if (updated) await doc.save();
      }

      codeToIdMap.set(item.code, doc._id);
      if (item.legacyCodes) {
        item.legacyCodes.forEach((lc) => codeToIdMap.set(lc, doc._id));
      }
    }

    // 2. Second pass: link parent-child hierarchy
    for (const item of STANDARD_CHART_OF_ACCOUNTS) {
      if (item.parentCode && codeToIdMap.has(item.parentCode)) {
        const parentId = codeToIdMap.get(item.parentCode);
        const currentId = codeToIdMap.get(item.code);

        if (parentId && currentId) {
          await Account.updateOne(
            { _id: currentId, parentId: null },
            { $set: { parentId } }
          );
        }
      }
    }

    logger.info('📊 Standard Chart of Accounts verified and synchronized successfully');
  } catch (error) {
    logger.error('❌ Failed to ensure standard chart of accounts:', error);
  }
}

/**
 * Get System Account by Key (Bulletproof resolver)
 * @param {string} systemKey - e.g. 'INVENTORY', 'COGS', 'SALES_REVENUE', 'AP', 'AR', 'CASH', 'BANK'
 * @param {Object} [session] - Optional MongoDB session
 * @returns {Promise<Object>} Account document
 */
export async function getSystemAccount(systemKey, session = null) {
  const config = SYSTEM_ACCOUNT_KEYS[systemKey];
  if (!config) {
    throw new Error(`مفتاح حساب النظام غير معروف (Unknown system account key: ${systemKey})`);
  }

  // 1. Try finding by primary code
  let query = Account.findOne({ code: config.code });
  if (session) query = query.session(session);
  let account = await query;

  // 2. If not found, check legacy codes
  if (!account && config.legacyCodes && config.legacyCodes.length > 0) {
    let legacyQuery = Account.findOne({ code: { $in: config.legacyCodes } });
    if (session) legacyQuery = legacyQuery.session(session);
    account = await legacyQuery;
  }

  // 3. If still not found, create it automatically on the fly
  if (!account) {
    const createData = {
      code: config.code,
      name: config.name,
      type: config.type,
      isSystem: true,
      isActive: true,
      description: `حساب نظام أساسي (${systemKey})`,
    };
    const options = session ? { session } : {};
    const [created] = await Account.create([createData], options);
    account = created;
    logger.warn(`⚠️ Auto-created missing system account on-demand: ${config.code} (${config.name})`);
  }

  return account;
}

/**
 * Get all core system accounts mapped in one batch query
 * @param {Object} [session]
 * @returns {Promise<Object>} Map of key -> account doc
 */
export async function getSystemAccountMap(session = null) {
  const allCodes = [];
  const keyToCodesMap = {};

  Object.entries(SYSTEM_ACCOUNT_KEYS).forEach(([key, conf]) => {
    const codes = [conf.code, ...(conf.legacyCodes || [])];
    keyToCodesMap[key] = codes;
    allCodes.push(...codes);
  });

  let query = Account.find({ code: { $in: allCodes } });
  if (session) query = query.session(session);
  const foundAccounts = await query;

  const codeDocMap = new Map(foundAccounts.map((a) => [a.code, a]));
  const resultMap = {};

  for (const [key, conf] of Object.entries(SYSTEM_ACCOUNT_KEYS)) {
    let match = codeDocMap.get(conf.code);
    if (!match && conf.legacyCodes) {
      for (const lc of conf.legacyCodes) {
        if (codeDocMap.get(lc)) {
          match = codeDocMap.get(lc);
          break;
        }
      }
    }

    if (match) {
      resultMap[key] = match;
    } else {
      // Fallback on-demand resolution
      resultMap[key] = await getSystemAccount(key, session);
    }
  }

  return resultMap;
}
