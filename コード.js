const baseUrl = "https://api.jquants.com/v1";

const MAIL_ADDRESS_KEY = "JQUANTSAPI_MAILADDRESS";
const PASSWORD_KEY = "JQUANTSAPI_PASSWORD";
const REFRESH_TOKEN_KEY = "JQUANTSAPI_REFRESHTOKEN";
const ID_TOKEN_KEY = "JQUANTSAPI_IDTOKEN";

let properties_ = null;

function setProperties(properties) {
  properties_ = properties;
}

function tokenAuthUser() {
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
  console.log(params);
  const response = UrlFetchApp.fetch(url, params);
  if (response.getResponseCode() == 200) {
    const contentText = response.getContentText();
    const refreshToken = JSON.parse(contentText).refreshToken;
    properties_.setProperty(REFRESH_TOKEN_KEY, refreshToken);
    return refreshToken;
  }
  return null;
}

function tokenAuthRefresh() {
  const fetchToken = (refreshToken, muteHttpExceptions) => {
    const url = `${baseUrl}/token/auth_refresh?refreshtoken=${refreshToken}`;
    const params = {
      method: `post`,
      muteHttpExceptions: muteHttpExceptions
    };
    return UrlFetchApp.fetch(url, params);
  };

  const registToken = response => {
    const contentText = response.getContentText();
    const idToken = JSON.parse(contentText).idToken;
    properties_.setProperty(ID_TOKEN_KEY, idToken);
    return idToken;
  };

  const refreshToken = properties_.getProperty(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    // まだリフレッシュトークンを取得していない場合は、リフレッシュトークンを取得する。
    const refreshToken = tokenAuthUser();
    const response = fetchToken(refreshToken, false);
    return registToken(response);
  } else {
    const response = fetchToken(refreshToken, true);
    if (response.getResponseCode() != 200) {
      // リフレッシュトークンが期限切れの場合は、新たにリフレッシュトークンを取得する。
      const refreshToken = tokenAuthUser();
      const response = fetchToken(refreshToken, false);
      return registToken(response);
    } else {
      return registToken(response);
    }
  }
}

function fetchWithToken_(url) {
  const fetchToken = (idToken, muteHttpExceptions) => {
    const params = {
      headers: {
        Authorization: `Bearer ${idToken}`
      },
      muteHttpExceptions: muteHttpExceptions
    };
    return UrlFetchApp.fetch(url, params);
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
 * @param {string} code 4桁の銘柄コードを指定した場合は、普通株式と優先株式の両方が上場している銘柄においては普通株式のデータのみが取得されます。
 * @param {Date} date 基準なる日付の指定
 */
function listed_info(code, date = new Date(new Date().setDate(new Date().getDate() - 12 * 7))) {
  const dateParam = Utilities.formatDate(date, `JST`, `yyyy-MM-dd`);
  const url = `${baseUrl}/listed/info?code=${code}&date=${dateParam}`;
  const response = fetchWithToken_(url);
  const contentText = response.getContentText();
  return JSON.parse(contentText).info[0];
}
