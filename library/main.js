const baseUrl = `https://api.jquants.com/v1`;

const MAIL_ADDRESS_KEY = `JQUANTSAPI_MAILADDRESS`;
const PASSWORD_KEY = `JQUANTSAPI_PASSWORD`;
const REFRESH_TOKEN_KEY = `JQUANTSAPI_REFRESHTOKEN`;
const ID_TOKEN_KEY = `JQUANTSAPI_IDTOKEN`;
const LOCK_KEY = `JQUANTSAPI_LOCK`;

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
 * @param {number} deadCount 確認待ちの間に、他のスレッドがロックを取得したまま死んだとみなすカウント。
 */
function waitForLock_(sleep = 1000, deadCount = 10) {
  let i = 0;
  for (; i < deadCount; i++) {
    if (!properties_.getProperty(LOCK_KEY)) {
      break;
    }
    Utilities.sleep(sleep);
  }

  // デッドカウントに達した場合は、強制的にロックを外す
  if (i == deadCount) {
    properties_.deleteProperty(LOCK_KEY);
    throw new Exception(`invalid lock state. please re-run function.`);
  }
}

function parseResponse_(response) {
  const contentText = response.getContentText();
  return JSON.parse(contentText);
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
  if (currentLock) {
    // 他のスレッドでリフレッシュトークンを更新中なので、lockがなくなるまでスリープする。
    waitForLock_();
    return properties_.getProperty(REFRESH_TOKEN_KEY);
  } else {
    properties_.setProperty(LOCK_KEY, lock);
    const currentLock = properties_.getProperty(LOCK_KEY);
    if (currentLock != lock) {
      // 他のスレッドでロックを再取得されたため、lockがなくなるまでスリープする。
      waitForLock_();
      return properties_.getProperty(REFRESH_TOKEN_KEY);
    }
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

  const refreshToken = parseResponse_(response).refreshToken;
  const currentLock1 = properties_.getProperty(LOCK_KEY);
  if (currentLock1 == lock) {
    properties_.setProperty(REFRESH_TOKEN_KEY, refreshToken);
    if (!inheritLock) {
      properties_.deleteProperty(LOCK_KEY);
    }
  } else {
    // 他のスレッドでロックを再取得されたため、lockがなくなるまでスリープする。
    //waitForLock_(); // 待っても良いけど、ここで取得した値をとっとと返して良い
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
    const idToken = parseResponse_(response).idToken;
    const currentLock = properties_.getProperty(LOCK_KEY);
    if (currentLock == lock) {
      properties_.setProperty(ID_TOKEN_KEY, idToken);
      properties_.deleteProperty(LOCK_KEY);
    } else {
      // 他のスレッドでロックを再取得されたため、lockがなくなるまでスリープする。
      //waitForLock_(); // 待っても良いけど、ここで取得した値をとっとと返して良い
    }
    return idToken;
  };

  // mutex lock
  const lock = Utilities.getUuid();
  const currentLock = properties_.getProperty(LOCK_KEY);
  if (currentLock) {
    // 他のスレッドでIDトークンを更新中なので、lockがなくなるまでスリープする。
    waitForLock_();
    return properties_.getProperty(ID_TOKEN_KEY);
  } else {
    properties_.setProperty(LOCK_KEY, lock);
    const currentLock = properties_.getProperty(LOCK_KEY);
    if (currentLock != lock) {
      // 他のスレッドでロックを再取得されたため、lockがなくなるまでスリープする。
      waitForLock_();
      return properties_.getProperty(ID_TOKEN_KEY);
    }
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
 * @param {string} paginationKey ページネーションキー
 * @return {object} レスポンスオブジェクト
 */
function fetchWithToken_(path, paginationKey) {
  const fetch = (idToken, muteHttpExceptions) => {
    const url = `${baseUrl}/${path}${paginationKey ? `${path.includes(`?`) ? `&` : `?`}pagination_key=${paginationKey}` : ``}`;
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
    const response = fetch(idToken, false);
    return parseResponse_(response);
  } else {
    const response = fetch(idToken, true);
    if (response.getResponseCode() != 200) {
      // IDトークンが期限切れの場合は、新たにIDトークンを取得する。
      const idToken = tokenAuthRefresh();
      const response = fetch(idToken, false);
      return parseResponse_(response);
    } else {
      return parseResponse_(response);
    }
  }
}

/**
 * ページネーションを加味して、全てのレスポンスを取得します。
 *
 * @param {string} path アクセス先パス
 * @param {string} field ページネーションするフィールド名
 * @return {object} レスポンスオブジェクト
 */
function fetchAll_(path, field) {
  const response = fetchWithToken_(path);

  // ページング処理
  let currentResponse = response;
  for (let paginationKey = currentResponse[`pagination_key`]; paginationKey; paginationKey = currentResponse[`pagination_key`]) {
    currentResponse = fetchWithToken_(path, paginationKey);
    response[field].push(...currentResponse[field]);
  }

  return response;
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
  const path = `listed/info${param  ? `?${param}` : ``}`;
  return fetchWithToken_(path);
}

/**
 * 株価四本値
 *
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/daily_quotes
 */
function pricesDailyQuotes(params) {
  const { code, date, from, to } = params || {date: latestDateForFreePlan()};
  const param = [
    code ? `code=${code}` : null,
    date ? `date=${date}` : null,
    from ? `from=${from}` : null,
    to ? `to=${to}` : null
  ].filter(Boolean).join(`&`);
  const path = `prices/daily_quotes${param ? `?${param}` : ``}`;
  return fetchAll_(path, `daily_quotes`);
}

/**
 * 財務情報
 *
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/statements
 */
function finsStatements(params) {
  const { code, date } = params || {};
  const param = [
    code ? `code=${code}` : null,
    date ? `date=${date}` : null
  ].filter(Boolean).join(`&`);
  const path = `fins/statements${param ? `?${param}` : ``}`;
  return fetchAll_(path, `statements`);
}

/**
 * 決算発表予定日
 *
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/announcement
 */
function finsAnnouncement(params) {
  const path = `fins/announcement`;
  return fetchAll_(path, `announcement`);
}

/**
 * 取引カレンダー
 *
 * @param {object} params リクエストパラメータ
 * @return {object} レスポンスオブジェクト
 * @see https://jpx.gitbook.io/j-quants-ja/api-reference/trading_calendar
 */
function marketsTradingCalendar(params) {
  const { holidaydivision, from, to } = params || {};
  const param = [
    holidaydivision ? `holidaydivision=${holidaydivision}` : null,
    from ? `from=${from}` : null,
    to ? `to=${to}` : null
  ].filter(Boolean).join(`&`);
  const path = `markets/trading_calendar${param ? `?${param}` : ``}`;
  return fetchWithToken_(path);
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
    case `FYFinancialStatements_Consolidated_JP`: return `決算短信（連結・日本基準）`;
    case `FYFinancialStatements_Consolidated_US`: return `決算短信（連結・米国基準）`;
    case `FYFinancialStatements_NonConsolidated_JP`: return `決算短信（非連結・日本基準）`;
    case `1QFinancialStatements_Consolidated_JP`: return `第1四半期決算短信（連結・日本基準）`;
    case `1QFinancialStatements_Consolidated_US`: return `第1四半期決算短信（連結・米国基準）`;
    case `1QFinancialStatements_NonConsolidated_JP`: return `第1四半期決算短信（非連結・日本基準）`;
    case `2QFinancialStatements_Consolidated_JP`: return `第2四半期決算短信（連結・日本基準）`;
    case `2QFinancialStatements_Consolidated_US`: return `第2四半期決算短信（連結・米国基準）`;
    case `2QFinancialStatements_NonConsolidated_JP`: return `第2四半期決算短信（非連結・日本基準）`;
    case `3QFinancialStatements_Consolidated_JP`: return `第3四半期決算短信（連結・日本基準）`;
    case `3QFinancialStatements_Consolidated_US`: return `第3四半期決算短信（連結・米国基準）`;
    case `3QFinancialStatements_NonConsolidated_JP`: return `第3四半期決算短信（非連結・日本基準）`;
    case `OtherPeriodFinancialStatements_Consolidated_JP`: return `その他四半期決算短信（連結・日本基準）`;
    case `OtherPeriodFinancialStatements_Consolidated_US`: return `その他四半期決算短信（連結・米国基準）`;
    case `OtherPeriodFinancialStatements_NonConsolidated_JP`: return `その他四半期決算短信（非連結・日本基準）`;
    case `FYFinancialStatements_Consolidated_JMIS`: return `決算短信（連結・ＪＭＩＳ）`;
    case `1QFinancialStatements_Consolidated_JMIS`: return `第1四半期決算短信（連結・ＪＭＩＳ）`;
    case `2QFinancialStatements_Consolidated_JMIS`: return `第2四半期決算短信（連結・ＪＭＩＳ）`;
    case `3QFinancialStatements_Consolidated_JMIS`: return `第3四半期決算短信（連結・ＪＭＩＳ）`;
    case `OtherPeriodFinancialStatements_Consolidated_JMIS`: return `その他四半期決算短信（連結・ＪＭＩＳ）`;
    case `FYFinancialStatements_NonConsolidated_IFRS`: return `決算短信（非連結・ＩＦＲＳ）`;
    case `1QFinancialStatements_NonConsolidated_IFRS`: return `第1四半期決算短信（非連結・ＩＦＲＳ）`;
    case `2QFinancialStatements_NonConsolidated_IFRS`: return `第2四半期決算短信（非連結・ＩＦＲＳ）`;
    case `3QFinancialStatements_NonConsolidated_IFRS`: return `第3四半期決算短信（非連結・ＩＦＲＳ）`;
    case `OtherPeriodFinancialStatements_NonConsolidated_IFRS`: return `その他四半期決算短信（非連結・ＩＦＲＳ）`;
    case `FYFinancialStatements_Consolidated_IFRS`: return `決算短信（連結・ＩＦＲＳ）`;
    case `1QFinancialStatements_Consolidated_IFRS`: return `第1四半期決算短信（連結・ＩＦＲＳ）`;
    case `2QFinancialStatements_Consolidated_IFRS`: return `第2四半期決算短信（連結・ＩＦＲＳ）`;
    case `3QFinancialStatements_Consolidated_IFRS`: return `第3四半期決算短信（連結・ＩＦＲＳ）`;
    case `OtherPeriodFinancialStatements_Consolidated_IFRS`: return `その他四半期決算短信（連結・ＩＦＲＳ）`;
    case `FYFinancialStatements_Consolidated_REIT`: return `決算短信（REIT）`;
    case `DividendForecastRevision`: return `配当予想の修正`;
    case `EarnForecastRevision`: return `業績予想の修正`;
    case `REITDividendForecastRevision`: return `分配予想の修正`;
    case `REITEarnForecastRevision`: return `利益予想の修正`;
    default: return typeOfDocument;
  }
}
