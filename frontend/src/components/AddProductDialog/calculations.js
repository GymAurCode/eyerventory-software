export function calcTotalStock(numCurtains, piecesPerCurtain) {
  return (numCurtains || 0) * (piecesPerCurtain || 0);
}

export function calcTotalCost(numCurtains, piecesPerCurtain, perPiecePrice, perCurtainPrice) {
  return (numCurtains || 0) * (piecesPerCurtain || 0) * (perPiecePrice || 0)
       + (numCurtains || 0) * (perCurtainPrice || 0);
}

export function calcMarginPercent(costPrice, sellingPrice) {
  if (!costPrice || costPrice === 0) return 0;
  return ((sellingPrice - costPrice) / costPrice) * 100;
}

export function calcRemainingBalance(totalAmount, amountPaid) {
  return (totalAmount || 0) - (amountPaid || 0);
}
