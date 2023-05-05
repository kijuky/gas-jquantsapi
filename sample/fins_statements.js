function jquants_fins_statements_(code, date) {
  return jquantsapi.finsStatements({code: code, date: date});
}

function jquants_fins_statements(code, date = jquantsapi.latestDateForFreePlan()) {
  if (!code) return [];

  const statements = jquants_fins_statements_(code).statements.reduce((acc, cur) => {
    // dateに一番近いデータを取得する
    if (acc) {
      const toTimeFromDate = dateText => Utilities.parseDate(dateText, "JST", "yyyy-MM-dd").getTime();
      const toTimeFromStat = stat => Utilities.parseDate(`${stat.DisclosedDate} ${stat.DisclosedTime}`, "JST", "yyyy-MM-dd hh:mm:ss").getTime();
      const time = toTimeFromDate(date);
      const accTime = toTimeFromStat(acc);
      const curTime = toTimeFromStat(cur);
      const accTimeDiff = Math.abs(accTime - time);
      const curTimeDiff = Math.abs(curTime - time);
      if (curTimeDiff < accTimeDiff) {
        return cur;
      }
    } else {
      return cur;
    }
    return acc;
  }, null);
  return !statements ? [] : [
    statements.DisclosedDate,
    statements.DisclosedTime,
    statements.LocalCode,
    statements.DisclosureNumber,
    jquantsapi.typeOfDocumentToText(statements.TypeOfDocument),
    statements.TypeOfCurrentPeriod,
    statements.CurrentPeriodStartDate,
    statements.CurrentPeriodEndDate,
    statements.CurrentFiscalYearStartDate,
    statements.CurrentFiscalYearEndDate,
    statements.NextFiscalYearStartDate,
    statements.NextFiscalYearEndDate,
    statements.NetSales,
    statements.OperatingProfit,
    statements.OrdinaryProfit,
    statements.Profit,
    statements.EarningsPerShare,
    statements.DilutedEarningsPerShare,
    statements.TotalAssets,
    statements.Equity,
    statements.EquityToAssetRatio,
    statements.BookValuePerShare,
    statements.CashFlowsFromOperatingActivities,
    statements.CashFlowsFromInvestingActivities,
    statements.CashFlowsFromFinancingActivities,
    statements.CashAndEquivalents,
    statements.ResultDividendPerShare1stQuarter,
    statements.ResultDividendPerShare2ndQuarter,
    statements.ResultDividendPerShare3rdQuarter,
    statements.ResultDividendPerShareFiscalYearEnd,
    statements.ResultDividendPerShareAnnual,
    statements[`DistributionsPerUnit(REIT)`],
    statements.ResultTotalDividendPaidAnnual,
    statements.ResultPayoutRatioAnnual,
    statements.ForecastDividendPerShare1stQuarter,
    statements.ForecastDividendPerShare2ndQuarter,
    statements.ForecastDividendPerShare3rdQuarter,
    statements.ForecastDividendPerShareFiscalYearEnd,
    statements.ForecastDividendPerShareAnnual,
    statements["ForecastDistributionsPerUnit(REIT)"],
    statements.ForecastTotalDividendPaidAnnual,
    statements.ForecastPayoutRatioAnnual,
    statements.NextYearForecastDividendPerShare1stQuarter,
    statements.NextYearForecastDividendPerShare2ndQuarter,
    statements.NextYearForecastDividendPerShare3rdQuarter,
    statements.NextYearForecastDividendPerShareFiscalYearEnd,
    statements.NextYearForecastDividendPerShareAnnual,
    statements["NextYearForecastDistributionsPerUnit(REIT)"],
    statements.NextYearForecastPayoutRatioAnnual,
    statements.ForecastNetSales2ndQuarter,
    statements.ForecastOperatingProfit2ndQuarter,
    statements.ForecastOrdinaryProfit2ndQuarter,
    statements.ForecastProfit2ndQuarter,
    statements.ForecastEarningsPerShare2ndQuarter,
    statements.NextYearForecastNetSales2ndQuarter,
    statements.NextYearForecastOperatingProfit2ndQuarter,
    statements.NextYearForecastOrdinaryProfit2ndQuarter,
    statements.NextYearForecastProfit2ndQuarter,
    statements.NextYearForecastEarningsPerShare2ndQuarter,
    statements.ForecastNetSales,
    statements.ForecastOperatingProfit,
    statements.ForecastOrdinaryProfit,
    statements.ForecastProfit,
    statements.ForecastEarningsPerShare,
    statements.NextYearForecastNetSales,
    statements.NextYearForecastOperatingProfit,
    statements.NextYearForecastOrdinaryProfit,
    statements.NextYearForecastProfit,
    statements.NextYearForecastEarningsPerShare,
    statements.MaterialChangesInSubsidiaries,
    statements.ChangesBasedOnRevisionsOfAccountingStandard,
    statements.ChangesOtherThanOnesBasedOnRevisionsOfAccountingStandard,
    statements.ChangesInAccountingEstimates,
    statements.RetrospectiveRestatement,
    statements.NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock,
    statements.NumberOfTreasuryStockAtTheEndOfFiscalYear,
    statements.AverageNumberOfShares,
    statements.NonConsolidatedNetSales,
    statements.NonConsolidatedOperatingProfit,
    statements.NonConsolidatedOrdinaryProfit,
    statements.NonConsolidatedProfit,
    statements.NonConsolidatedEarningsPerShare,
    statements.NonConsolidatedTotalAssets,
    statements.NonConsolidatedEquity,
    statements.NonConsolidatedEquityToAssetRatio,
    statements.NonConsolidatedBookValuePerShare,
    statements.ForecastNonConsolidatedNetSales2ndQuarter,
    statements.ForecastNonConsolidatedOperatingProfit2ndQuarter,
    statements.ForecastNonConsolidatedOrdinaryProfit2ndQuarter,
    statements.ForecastNonConsolidatedProfit2ndQuarter,
    statements.ForecastNonConsolidatedEarningsPerShare2ndQuarter,
    statements.NextYearForecastNonConsolidatedNetSales2ndQuarter,
    statements.NextYearForecastNonConsolidatedOperatingProfit2ndQuarter,
    statements.NextYearForecastNonConsolidatedOrdinaryProfit2ndQuarter,
    statements.NextYearForecastNonConsolidatedProfit2ndQuarter,
    statements.NextYearForecastNonConsolidatedEarningsPerShare2ndQuarter,
    statements.ForecastNonConsolidatedNetSales,
    statements.ForecastNonConsolidatedOperatingProfit,
    statements.ForecastNonConsolidatedOrdinaryProfit,
    statements.ForecastNonConsolidatedProfit,
    statements.ForecastNonConsolidatedEarningsPerShare,
    statements.NextYearForecastNonConsolidatedNetSales,
    statements.NextYearForecastNonConsolidatedOperatingProfit,
    statements.NextYearForecastNonConsolidatedOrdinaryProfit,
    statements.NextYearForecastNonConsolidatedProfit,
    statements.NextYearForecastNonConsolidatedEarningsPerShare
  ];
}
