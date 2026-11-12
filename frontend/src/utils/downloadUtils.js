const GAME_CSV_FILENAMES = {
  prisoner: "2x2 Economic Games.csv",
  ultimatum: "Ultimatum.csv",
  public_goods: "Public Goods.csv",
  common_pool: "Common-Pool Resource.csv",
  all: "All Games.csv",
}

export const getGameCsvFilename = (response, gameType) => {
  const disposition = response.headers.get("Content-Disposition") || ""
  const filename = disposition.match(/filename="([^"]+)"/i)?.[1]
  return filename || GAME_CSV_FILENAMES[gameType]
}
