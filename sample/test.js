// その日のうちでもっとも取引代金が多い企業コードを返す
function jquants_most_high_volume_code(date) {
  const quotes = jquantsapi.pricesDailyQuotes({date: date || jquantsapi.latestDateForFreePlan()});
  console.log(quotes.daily_quotes.length);
  console.log(quotes["pagination_key"]);
  if (!quotes.daily_quotes.length) return null;

  const quote = quotes.daily_quotes.reduce((acc, cur) => {
    return acc.Volume < cur.Volume ? cur : acc;
  });

  return quote.Code
}

// コードと取引代金のテーブルを返す（取引代金の降順）
function jquants_table_code_volume(date) {
  const quotes = jquantsapi.pricesDailyQuotes({date: date || jquantsapi.latestDateForFreePlan()});
  if (!quotes.daily_quotes.length) return null;

  const result = quotes.daily_quotes.map(x => [x.Code, x.Volume]).sort((a, b) => b[1] - a[1]);
  return result;
}

// そのコードの企業名と業界名を返す
function jquants_company_name(code, date) {
  const info = jquantsapi.listedInfo({code: code, date: date || jquantsapi.latestDateForFreePlan()});
  const result = info.info.map(x => [x.CompanyName, x.Sector17CodeName]);

  return result;
}

function aaa() {
  const info = jquantsapi.finsStatements({date: "2022-05-13"});
  console.log(info.statements.length);
  console.log(info["pagination_key"]);
  const result = info.statements.map(x => x.LocalCode);

  return result;
}
