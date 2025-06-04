import { buildQueryString } from '../../buildQueryString';
import config from '../../../../../config.json';

/**
 * Generate a cURL command string to execute the current API query.
 *
 * @param formData - Current form data for the query.
 * @param dateRange - Date range filter for the query.
 * @param selectedAlias - Selected collection alias.
 * @param solrDatabaseId - Selected Solr database ID.
 * @param getNER - Whether to enable Named Entity Recognition.
 * @param downloadOnly - Whether to only download results without displaying.
 * @param statsLevel - Level of statistics detail to request.
 * @param accessToken - Authorization bearer token.
 * @returns A string containing the complete cURL command.
 */
export const generateCurlCommand = (
  formData: any,
  dateRange: any,
  selectedAlias: string,
  solrDatabaseId: number,
  getNER: boolean,
  downloadOnly: boolean,
  statsLevel: string,
  accessToken: string
): string => {
  const queryString = buildQueryString(formData, dateRange);
  if (!queryString) {
    throw new Error('Query string is empty.');
  }
  
  const batchSize = config.batch_size;
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
  
  return `curl -H "Authorization: Bearer ${accessToken}" "${url}"`;
};

/**
 * Generate a Python script string to perform the current API query and load results.
 *
 * @param formData - Current form data for the query.
 * @param dateRange - Date range filter for the query.
 * @param selectedAlias - Selected collection alias.
 * @param solrDatabaseId - Selected Solr database ID.
 * @param getNER - Whether to enable Named Entity Recognition.
 * @param downloadOnly - Whether to only download results without displaying.
 * @param statsLevel - Level of statistics detail to request.
 * @param accessToken - Authorization bearer token.
 * @returns A string containing the Python script.
 */
export const generatePythonScript = (
  formData: any,
  dateRange: any,
  selectedAlias: string,
  solrDatabaseId: number,
  getNER: boolean,
  downloadOnly: boolean,
  statsLevel: string,
  accessToken: string
): string => {
  const queryString = buildQueryString(formData, dateRange);
  const batchSize = config.batch_size;
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
  
  return `
import requests
import pandas as pd

url = "${url}"
token = "${accessToken}"
headers = {"Authorization": "Bearer " + token}
response = requests.get(url, headers=headers)
data = response.json()
docs = data.get("solr_response", {}).get("response", {}).get("docs", [])
df = pd.DataFrame(docs)
print(df)
  `.trim();
};

/**
 * Generate an R script string to perform the current API query and load results.
 *
 * @param formData - Current form data for the query.
 * @param dateRange - Date range filter for the query.
 * @param selectedAlias - Selected collection alias.
 * @param solrDatabaseId - Selected Solr database ID.
 * @param getNER - Whether to enable Named Entity Recognition.
 * @param downloadOnly - Whether to only download results without displaying.
 * @param statsLevel - Level of statistics detail to request.
 * @param accessToken - Authorization bearer token.
 * @returns A string containing the R script.
 */
export const generateRScript = (
  formData: any,
  dateRange: any,
  selectedAlias: string,
  solrDatabaseId: number,
  getNER: boolean,
  downloadOnly: boolean,
  statsLevel: string,
  accessToken: string
): string => {
  const queryString = buildQueryString(formData, dateRange);
  const batchSize = config.batch_size;
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
  
  return `
library(httr)
library(jsonlite)

url <- "${url}"
token <- "${accessToken}"
response <- GET(url, add_headers(Authorization = paste("Bearer", token)))
data <- content(response, "text", encoding = "UTF-8")
parsed <- fromJSON(data)
df <- as.data.frame(parsed$solr_response$response$docs)
print(df)
  `.trim();
};