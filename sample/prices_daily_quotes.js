function jquants_daily_quotes_(code, date) {
  return jquantsapi.pricesDailyQuotes({code: code, date: date || jquantsapi.latestDateForFreePlan()});
}

function jquants_daily_quotes(code, date) {
  const dailyQuotes = jquants_daily_quotes_(code, date).daily_quotes[0];
  return [
    dailyQuotes.Date,
    dailyQuotes.Code,
    dailyQuotes.Open,
    dailyQuotes.High,
    dailyQuotes.Low,
    dailyQuotes.Close,
    dailyQuotes.Volume,
    dailyQuotes.TurnoverValue,
    dailyQuotes.AdjustmentFactor,
    dailyQuotes.AdjustmentOpen,
    dailyQuotes.AdjustmentHigh,
    dailyQuotes.AdjustmentLow,
    dailyQuotes.AdjustmentClose,
    dailyQuotes.AdjustmentVolume
  ];
}
