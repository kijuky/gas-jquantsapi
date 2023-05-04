const baseUrl = "https://api.jquants.com/v1";

const MAIL_ADDRESS_KEY = "JQUANTSAPI_MAILADDRESS";
const PASSWORD_KEY = "JQUANTSAPI_PASSWORD";
const REFRESH_TOKEN_KEY = "JQUANTSAPI_REFRESHTOKEN";
const ID_TOKEN_KEY = "JQUANTSAPI_IDTOKEN";
const LOCK_KEY = "JQUANTSAPI_LOCK";

let properties_ = null;

/**
 * 利用するプロパティストアを設定します。 
 *
 * @param {Properties} properties プロパティストア
 */
function setProperties(properties) {
  properties_ = properties;
}

/**
 * urlにアクセス後にスリープします。
 * 
 * @param {string} url アクセス先URL
 * @param {object} params 高度なパラメータ
 * @param {number} sleep アクセス後にスリープする時間(ms)
 * @return {HTTPResponse} レスポンス
 */
function fetchAndWait_(url, params, sleep = 1000) {
  const response = UrlFetchApp.fetch(url, params);
  Utilities.sleep(sleep);
  return response;
}

/**
 * ロックが解放されるまでスリープします。 
 *
 * @param {number} sleep ロックの解放を確認する時間(ms)
 */
function waitForLock_(sleep = 1000) {
  do {
    Utilities.sleep(sleep);
  } while(!properties_.getProperty(LOCK_KEY));
}

/**
 * リフレッシュトークンを取得し、プロパティストアに設定します。
 * 
 * @param {string} inheritLock 継承されたロック
 * @return {string} リフレッシュトークン
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/refreshtoken
 */
function tokenAuthUser(inheritLock) {
  const lock = inheritLock || Utilities.getUuid();

  // mutex lock
  const currentLock = properties_.getProperty(LOCK_KEY);
  if (currentLock == null) {
    properties_.setProperty(LOCK_KEY, lock);
  } else if (currentLock != lock) {
    // 他のスレッドでリフレッシュトークンを更新中なので、lockがなくなるまでスリープする。
    waitForLock_();
    return properties_.getProperty(REFRESH_TOKEN_KEY);
  }

  const url = `${baseUrl}/token/auth_user`;
  const mailaddress = properties_.getProperty(MAIL_ADDRESS_KEY);
  const password = properties_.getProperty(PASSWORD_KEY);
  const params = {
    method: `post`,
    contentType: `application/json`,
    payload: JSON.stringify({
      mailaddress: mailaddress,
      password: password
    })
  };
  const response = fetchAndWait_(url, params);

  const contentText = response.getContentText();
  const refreshToken = JSON.parse(contentText).refreshToken;
  const currentLock1 = properties_.getProperty(LOCK_KEY);
  if (currentLock1 == lock) {
    properties_.setProperty(REFRESH_TOKEN_KEY, refreshToken);
    if (!inheritLock) {
      properties_.deleteProperty(LOCK_KEY);
    }
  } else {
    // 他のスレッドでロックを再取得されたため、lockがなくなるまでスリープする。
    waitForLock_();
  }
  return refreshToken;
}

/**
 * IDトークンを取得し、プロパティストアに設定します。 
 *
 * @return {string} IDトークン
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/idtoken
 */
function tokenAuthRefresh() {
  const fetchToken = (refreshToken, muteHttpExceptions) => {
    const url = `${baseUrl}/token/auth_refresh?refreshtoken=${refreshToken}`;
    const params = {
      method: `post`,
      muteHttpExceptions: muteHttpExceptions
    };
    return fetchAndWait_(url, params);
  };

  const registToken = (response, lock) => {
    const contentText = response.getContentText();
    const idToken = JSON.parse(contentText).idToken;
    const currentLock = properties_.getProperty(LOCK_KEY);
    if (currentLock == lock) {
      properties_.setProperty(ID_TOKEN_KEY, idToken);
      properties_.deleteProperties(LOCK_KEY);
    } else {
      // 他のスレッドでロックを再取得されたため、lockがなくなるまでスリープする。
      waitForLock_();
    }
    return idToken;
  };

  // mutex lock
  const currentLock = properties_.getProperty(LOCK_KEY);
  const lock = Utilities.getUuid();
  if (!currentLock) {
    properties_.setProperty(LOCK_KEY, lock);
  } else {
    // 他のスレッドでIDトークンを更新中なので、lockがなくなるまでスリープする。
    waitForLock_();
    return properties_.getProperty(ID_TOKEN_KEY);
  }

  const refreshToken = properties_.getProperty(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    // まだリフレッシュトークンを取得していない場合は、リフレッシュトークンを取得する。
    const refreshToken = tokenAuthUser(lock);
    const response = fetchToken(refreshToken, false);
    return registToken(response, lock);
  } else {
    const response = fetchToken(refreshToken, true);
    if (response.getResponseCode() != 200) {
      // リフレッシュトークンが期限切れの場合は、新たにリフレッシュトークンを取得する。
      const refreshToken = tokenAuthUser(lock);
      const response = fetchToken(refreshToken, false);
      return registToken(response, lock);
    } else {
      return registToken(response, lock);
    }
  }
}

/**
 * IDトークンを付与してurlにアクセスします。
 *
 * @param {string} path アクセス先パス
 * @return {HTTPResponse} レスポンス
 */
function fetchWithToken_(path) {
  const fetchToken = (idToken, muteHttpExceptions) => {
    const url = `${baseUrl}/${path}`;
    const params = {
      headers: {
        Authorization: `Bearer ${idToken}`
      },
      muteHttpExceptions: muteHttpExceptions
    };
    return fetchAndWait_(url, params);
  };

  const idToken = properties_.getProperty(ID_TOKEN_KEY);
  if (!idToken) {
    // まだIDトークンを取得していない場合は、IDトークンを取得する。
    const idToken = tokenAuthRefresh();
    return fetchToken(idToken, false);
  } else {
    const response = fetchToken(idToken, true);
    if (response.getResponseCode() != 200) {
      // IDトークンが期限切れの場合は、新たにIDトークンを取得する。
      const idToken = tokenAuthRefresh();
      return fetchToken(idToken, false);
    } else {
      return response;
    }
  }
}

/**
 * J-Quantsのフリープランでの最新日付を返します。
 *
 * @return {string} フリープランでの最新日付
 * @see https://jpx.gitbook.io/j-quants-ja/outline/data-spec
 */
function latestDateForFreePlan() {
  // 12週間前の日付を返す。
  const date = new Date();
  date.setDate(date.getDate() - 12 * 7);
  return Utilities.formatDate(date, `JST`, `yyyy-MM-dd`);
}

/** @deprecated */
function listed_info(code, date) {
  return listedInfo(code, date).info[0];
}

/**
 * 上場銘柄一覧
 *
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/listed_info
 */
function listedInfo(params) {
  const { code, date } = params || {date: latestDateForFreePlan()};
  const param = [
    code ? `code=${code}` : null,
    date ? `date=${date}` : null
  ].filter(Boolean).join(`&`);
  const path = `listed/info?${param}`;
  const response = fetchWithToken_(path);
  const contentText = response.getContentText();
  return JSON.parse(contentText);
}

/**
 * 株価四本値
 * 
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/daily_quotes
 */
function pricesDailyQuotes(params) {
  const { code, date, from, to, pagination_key } = params || {date: latestDateForFreePlan()};
  const param = [
    code ? `code=${code}` : null,
    date ? `date=${date}` : null,
    from ? `from=${from}` : null,
    to ? `to=${to}` : null,
    pagination_key ? `pagination_key=${pagination_key}` : null
  ].filter(Boolean).join(`&`);
  const path = `prices/daily_quotes?${param}`;
  const response = fetchWithToken_(path);
  const contentText = response.getContentText();
  return JSON.parse(contentText);
}

/**
 * 財務情報
 * 
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/statements
 */
function finsStatements(params) {
  const { code, date, pagination_key } = params || {};
  const param = [
    code ? `code=${code}` : null,
    date ? `date=${date}` : null,
    pagination_key ? `pagination_key=${pagination_key}` : null
  ].filter(Boolean).join(`&`);
  const path = `fins/statements?${param}`;
  const response = fetchWithToken_(path);
  const contentText = response.getContentText();
  return JSON.parse(contentText);
}

/**
 * 決算発表予定日
 * 
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/announcement
 */
function finsAnnouncement(params) {
  const { pagination_key } = params || {};
  const param = [
    pagination_key ? `pagination_key=${pagination_key}` : null
  ].filter(Boolean).join(`&`);
  const path = `fins/announcement?${param}`;
  const response = fetchWithToken_(path);
  const contentText = response.getContentText();
  return JSON.parse(contentText);
}

/**
 * 開示書類種別
 * 
 * @param {string} typeOfDocument 開示書類種別
 * @return {string} 対応する概要（JP）なければtypeDocumentを返します。
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/statements/typeofdocument
 */
function typeOfDocumentToText(typeOfDocument) {
  switch (typeOfDocument) {
    case "FYFinancialStatements_Consolidated_JP": return "決算短信（連結・日本基準）";
    case "FYFinancialStatements_Consolidated_US": return "決算短信（連結・米国基準）";
    case "FYFinancialStatements_NonConsolidated_JP": return "決算短信（非連結・日本基準）";
    case "1QFinancialStatements_Consolidated_JP": return "第1四半期決算短信（連結・日本基準）";
    case "1QFinancialStatements_Consolidated_US": return "第1四半期決算短信（連結・米国基準）";
    case "1QFinancialStatements_NonConsolidated_JP": return "第1四半期決算短信（非連結・日本基準）";
    case "2QFinancialStatements_Consolidated_JP": return "第2四半期決算短信（連結・日本基準）";
    case "2QFinancialStatements_Consolidated_US": return "第2四半期決算短信（連結・米国基準）";
    case "2QFinancialStatements_NonConsolidated_JP": return "第2四半期決算短信（非連結・日本基準）";
    case "3QFinancialStatements_Consolidated_JP": return "第3四半期決算短信（連結・日本基準）";
    case "3QFinancialStatements_Consolidated_US": return "第3四半期決算短信（連結・米国基準）";
    case "3QFinancialStatements_NonConsolidated_JP": return "第3四半期決算短信（非連結・日本基準）";
    case "OtherPeriodFinancialStatements_Consolidated_JP": return "その他四半期決算短信（連結・日本基準）";
    case "OtherPeriodFinancialStatements_Consolidated_US": return "その他四半期決算短信（連結・米国基準）";
    case "OtherPeriodFinancialStatements_NonConsolidated_JP": return "その他四半期決算短信（非連結・日本基準）";
    case "FYFinancialStatements_Consolidated_JMIS": return "決算短信（連結・ＪＭＩＳ）";
    case "1QFinancialStatements_Consolidated_JMIS": return "第1四半期決算短信（連結・ＪＭＩＳ）";
    case "2QFinancialStatements_Consolidated_JMIS": return "第2四半期決算短信（連結・ＪＭＩＳ）";
    case "3QFinancialStatements_Consolidated_JMIS": return "第3四半期決算短信（連結・ＪＭＩＳ）";
    case "OtherPeriodFinancialStatements_Consolidated_JMIS": return "その他四半期決算短信（連結・ＪＭＩＳ）";
    case "FYFinancialStatements_NonConsolidated_IFRS": return "決算短信（非連結・ＩＦＲＳ）";
    case "1QFinancialStatements_NonConsolidated_IFRS": return "第1四半期決算短信（非連結・ＩＦＲＳ）";
    case "2QFinancialStatements_NonConsolidated_IFRS": return "第2四半期決算短信（非連結・ＩＦＲＳ）";
    case "3QFinancialStatements_NonConsolidated_IFRS": return "第3四半期決算短信（非連結・ＩＦＲＳ）";
    case "OtherPeriodFinancialStatements_NonConsolidated_IFRS": return "その他四半期決算短信（非連結・ＩＦＲＳ）";
    case "FYFinancialStatements_Consolidated_IFRS": return "決算短信（連結・ＩＦＲＳ）";
    case "1QFinancialStatements_Consolidated_IFRS": return "第1四半期決算短信（連結・ＩＦＲＳ）";
    case "2QFinancialStatements_Consolidated_IFRS": return "第2四半期決算短信（連結・ＩＦＲＳ）";
    case "3QFinancialStatements_Consolidated_IFRS": return "第3四半期決算短信（連結・ＩＦＲＳ）";
    case "OtherPeriodFinancialStatements_Consolidated_IFRS": return "その他四半期決算短信（連結・ＩＦＲＳ）";
    case "FYFinancialStatements_Consolidated_REIT": return "決算短信（REIT）";
    case "DividendForecastRevision": return "配当予想の修正";
    case "EarnForecastRevision": return "業績予想の修正";
    case "REITDividendForecastRevision": return "分配予想の修正";
    case "REITEarnForecastRevision": return "利益予想の修正";
    default: return typeOfDocument;
  }
}
