// app/frontend/src/containers/components/MetadataForm/utils/codeGenerator.ts
import { buildQueryString } from '../../buildQueryString';
import config from '../../../../../config.json';

export const generateCurlCommand = (
  formData: any,
  dateRange: any,
  selectedAlias: string,
  solrDatabaseId: number,
  getNER: boolean,
  downloadOnly: boolean,
  statsLevel: string,
  accessToken: string,
  rawQuery?: string
): string => {
  let queryString: string;
  
  if (rawQuery) {
    queryString = rawQuery;
  } else {
    queryString = buildQueryString(formData, dateRange);
  }
  
  if (!queryString) {
    throw new Error('Query string is empty.');
  }
  
  const batchSize = config.batch_size;
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
  
  return `#!/bin/bash
# Generated cURL command for HistText API
# Query: ${queryString.slice(0, 100)}${queryString.length > 100 ? '...' : ''}
# Collection: ${selectedAlias}
# Database ID: ${solrDatabaseId}

curl -H "Authorization: Bearer ${accessToken}" \\
     -H "Content-Type: application/json" \\
     -H "Accept: application/json" \\
     "${url}"`;
};

export const generatePythonScript = (
  formData: any,
  dateRange: any,
  selectedAlias: string,
  solrDatabaseId: number,
  getNER: boolean,
  downloadOnly: boolean,
  statsLevel: string,
  accessToken: string,
  rawQuery?: string
): string => {
  let queryString: string;
  
  if (rawQuery) {
    queryString = rawQuery;
  } else {
    queryString = buildQueryString(formData, dateRange);
  }
  
  const batchSize = config.batch_size;
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
  
  return `#!/usr/bin/env python3
"""
Generated Python script for HistText API
Query: ${queryString.slice(0, 100)}${queryString.length > 100 ? '...' : ''}
Collection: ${selectedAlias}
Database ID: ${solrDatabaseId}

Requirements:
    pip install requests pandas

Usage:
    python this_script.py
"""

import requests
import pandas as pd
import json
from typing import Dict, List, Optional

# Configuration
API_BASE_URL = "${baseUrl}"
ACCESS_TOKEN = "${accessToken}"
COLLECTION = "${selectedAlias}"
DATABASE_ID = ${solrDatabaseId}

# Query parameters
QUERY_PARAMS = {
    "collection": COLLECTION,
    "query": "${queryString}",
    "start": 0,
    "rows": ${batchSize},
    "get_ner": ${getNER},
    "download_only": ${downloadOnly},
    "stats_level": "${statsLevel}",
    "solr_database_id": DATABASE_ID,
    "is_first": True
}

class HistTextClient:
    def __init__(self, base_url: str, access_token: str):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
    
    def query_documents(self, params: Dict) -> Dict:
        """Execute a document query against the HistText API."""
        url = f"{self.base_url}/api/solr/query"
        
        try:
            response = self.session.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error making request: {e}")
            raise
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            raise
    
    def get_all_documents(self, query: str, collection: str, database_id: int, 
                         batch_size: int = ${batchSize}) -> List[Dict]:
        """Fetch all documents matching the query."""
        all_docs = []
        start = 0
        
        while True:
            params = {
                "collection": collection,
                "query": query,
                "start": start,
                "rows": batch_size,
                "solr_database_id": database_id
            }
            
            print(f"Fetching documents {start} to {start + batch_size}...")
            
            try:
                result = self.query_documents(params)
                docs = result.get("solr_response", {}).get("response", {}).get("docs", [])
               
               if not docs:
                   break
               
               all_docs.extend(docs)
               start += batch_size
               
               # Check if we've got all documents
               total_found = result.get("solr_response", {}).get("response", {}).get("numFound", 0)
               if start >= total_found:
                   break
                   
           except Exception as e:
               print(f"Error fetching batch starting at {start}: {e}")
               break
       
       return all_docs

def main():
   """Main execution function."""
   print("HistText API Query Script")
   print("=" * 40)
   print(f"Collection: {COLLECTION}")
   print(f"Query: ${queryString}")
   print(f"Database ID: {DATABASE_ID}")
   print()
   
   # Initialize client
   client = HistTextClient(API_BASE_URL, ACCESS_TOKEN)
   
   try:
       # Execute initial query
       print("Executing query...")
       result = client.query_documents(QUERY_PARAMS)
       
       # Extract documents
       docs = result.get("solr_response", {}).get("response", {}).get("docs", [])
       total_found = result.get("solr_response", {}).get("response", {}).get("numFound", 0)
       
       print(f"Found {total_found} total documents")
       print(f"Retrieved {len(docs)} documents in first batch")
       
       if docs:
           # Convert to DataFrame
           df = pd.DataFrame(docs)
           print(f"\\nDataFrame shape: {df.shape}")
           print(f"Columns: {list(df.columns)}")
           
           # Display first few rows
           print("\\nFirst 5 rows:")
           print(df.head())
           
           # Save to CSV
           output_file = f"histtext_results_{COLLECTION}.csv"
           df.to_csv(output_file, index=False)
           print(f"\\nResults saved to: {output_file}")
           
           # Optional: Get all documents if needed
           if total_found > len(docs):
               print(f"\\nFetching all {total_found} documents...")
               all_docs = client.get_all_documents(
                   "${queryString}", 
                   COLLECTION, 
                   DATABASE_ID
               )
               
               df_all = pd.DataFrame(all_docs)
               output_file_all = f"histtext_all_results_{COLLECTION}.csv"
               df_all.to_csv(output_file_all, index=False)
               print(f"All results saved to: {output_file_all}")
       
       else:
           print("No documents found matching the query.")
           
   except Exception as e:
       print(f"Error: {e}")
       return 1
   
   return 0

if __name__ == "__main__":
   exit(main())`;
};

export const generateRScript = (
 formData: any,
 dateRange: any,
 selectedAlias: string,
 solrDatabaseId: number,
 getNER: boolean,
 downloadOnly: boolean,
 statsLevel: string,
 accessToken: string,
 rawQuery?: string
): string => {
 let queryString: string;
 
 if (rawQuery) {
   queryString = rawQuery;
 } else {
   queryString = buildQueryString(formData, dateRange);
 }
 
 const batchSize = config.batch_size;
 const baseUrl = window.location.origin;
 const url = `${baseUrl}/api/solr/query?collection=${encodeURIComponent(selectedAlias)}&query=${encodeURIComponent(queryString)}&start=0&rows=${batchSize}&get_ner=${getNER}&download_only=${downloadOnly}&stats_level=${statsLevel}&solr_database_id=${solrDatabaseId}&is_first=true`;
 
 return `#!/usr/bin/env Rscript
#
# Generated R script for HistText API
# Query: ${queryString.slice(0, 100)}${queryString.length > 100 ? '...' : ''}
# Collection: ${selectedAlias}
# Database ID: ${solrDatabaseId}
#
# Requirements:
#   install.packages(c("httr", "jsonlite", "dplyr", "readr"))
#
# Usage:
#   Rscript this_script.R

# Load required libraries
suppressMessages({
 library(httr)
 library(jsonlite)
 library(dplyr)
 library(readr)
})

# Configuration
API_BASE_URL <- "${baseUrl}"
ACCESS_TOKEN <- "${accessToken}"
COLLECTION <- "${selectedAlias}"
DATABASE_ID <- ${solrDatabaseId}
QUERY_STRING <- "${queryString}"

# Query parameters
query_params <- list(
 collection = COLLECTION,
 query = QUERY_STRING,
 start = 0,
 rows = ${batchSize},
 get_ner = ${getNER ? 'TRUE' : 'FALSE'},
 download_only = ${downloadOnly ? 'TRUE' : 'FALSE'},
 stats_level = "${statsLevel}",
 solr_database_id = DATABASE_ID,
 is_first = TRUE
)

#' Execute HistText API Query
#'
#' @param base_url API base URL
#' @param token Access token
#' @param params Query parameters
#' @return Parsed JSON response
query_histtext <- function(base_url, token, params) {
 url <- paste0(base_url, "/api/solr/query")
 
 response <- GET(
   url,
   query = params,
   add_headers(
     Authorization = paste("Bearer", token),
     \`Content-Type\` = "application/json",
     Accept = "application/json"
   )
 )
 
 if (status_code(response) != 200) {
   stop("API request failed with status: ", status_code(response))
 }
 
 content(response, "text", encoding = "UTF-8") %>%
   fromJSON(flatten = TRUE)
}

#' Fetch all documents matching query
#'
#' @param query Query string
#' @param collection Collection name
#' @param database_id Database ID
#' @param batch_size Number of documents per batch
#' @return Data frame with all documents
get_all_documents <- function(query, collection, database_id, batch_size = ${batchSize}) {
 all_docs <- list()
 start <- 0
 
 repeat {
   cat("Fetching documents", start, "to", start + batch_size, "...\\n")
   
   params <- list(
     collection = collection,
     query = query,
     start = start,
     rows = batch_size,
     solr_database_id = database_id
   )
   
   tryCatch({
     result <- query_histtext(API_BASE_URL, ACCESS_TOKEN, params)
     docs <- result$solr_response$response$docs
     
     if (length(docs) == 0) break
     
     all_docs <- append(all_docs, list(docs), after = length(all_docs))
     start <- start + batch_size
     
     total_found <- result$solr_response$response$numFound
     if (start >= total_found) break
     
   }, error = function(e) {
     cat("Error fetching batch starting at", start, ":", e$message, "\\n")
     break
   })
 }
 
 if (length(all_docs) > 0) {
   do.call(rbind, lapply(all_docs, as.data.frame, stringsAsFactors = FALSE))
 } else {
   data.frame()
 }
}

# Main execution
main <- function() {
 cat("HistText API Query Script\\n")
 cat("========================================\\n")
 cat("Collection:", COLLECTION, "\\n")
 cat("Query:", QUERY_STRING, "\\n")
 cat("Database ID:", DATABASE_ID, "\\n\\n")
 
 tryCatch({
   # Execute initial query
   cat("Executing query...\\n")
   result <- query_histtext(API_BASE_URL, ACCESS_TOKEN, query_params)
   
   # Extract documents
   docs <- result$solr_response$response$docs
   total_found <- result$solr_response$response$numFound
   
   cat("Found", total_found, "total documents\\n")
   cat("Retrieved", length(docs), "documents in first batch\\n")
   
   if (length(docs) > 0) {
     # Convert to data frame
     df <- as.data.frame(docs, stringsAsFactors = FALSE)
     
     cat("\\nData frame dimensions:", paste(dim(df), collapse = " x "), "\\n")
     cat("Columns:", paste(names(df), collapse = ", "), "\\n")
     
     # Display first few rows
     cat("\\nFirst 5 rows:\\n")
     print(head(df, 5))
     
     # Save to CSV
     output_file <- paste0("histtext_results_", COLLECTION, ".csv")
     write_csv(df, output_file)
     cat("\\nResults saved to:", output_file, "\\n")
     
     # Optional: Get all documents if needed
     if (total_found > length(docs)) {
       cat("\\nFetching all", total_found, "documents...\\n")
       df_all <- get_all_documents(QUERY_STRING, COLLECTION, DATABASE_ID)
       
       if (nrow(df_all) > 0) {
         output_file_all <- paste0("histtext_all_results_", COLLECTION, ".csv")
         write_csv(df_all, output_file_all)
         cat("All results saved to:", output_file_all, "\\n")
       }
     }
     
     # Return data frame for further analysis
     return(df)
     
   } else {
     cat("No documents found matching the query.\\n")
     return(data.frame())
   }
   
 }, error = function(e) {
   cat("Error:", e$message, "\\n")
   return(NULL)
 })
}

# Execute main function
result_df <- main()

# Optional: Additional analysis
if (!is.null(result_df) && nrow(result_df) > 0) {
 cat("\\n=== Additional Analysis ===\\n")
 
 # Show data summary
 cat("Data summary:\\n")
 print(summary(result_df))
 
 # Show column types
 cat("\\nColumn types:\\n")
 sapply(result_df, class) %>% print()
 
 cat("\\nScript completed successfully!\\n")
}
`;
};