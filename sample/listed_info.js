function jquants_info_(code, date) {
  return jquantsapi.listedInfo({code: code, date: date || jquantsapi.latestDateForFreePlan()});
}

function jquants_info(code, date) {
  const info = jquants_info_(code, date).info[0];
  return [
    info.Date,
    info.Code,
    info.CompanyName,
    info.CompanyNameEnglish,
    info.Sector17Code,
    info.Sector17CodeName,
    info.Sector33Code,
    info.Sector33CodeName,
    info.ScaleCategory,
    info.MarketCode,
    info.MarketCodeName
  ];
}
