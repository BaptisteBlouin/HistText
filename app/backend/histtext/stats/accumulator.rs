//! Data accumulation utilities for statistical analysis.

use super::types::Accumulator;

impl Accumulator {
    /// Merges another accumulator into this one
    /// 
    /// # Arguments
    /// * `other` - Another accumulator to merge data from
    pub fn merge(&mut self, other: Accumulator) {
        // Merge date counts
        for (key, value) in other.date_counts {
            *self.date_counts.entry(key).or_insert(0) += value;
        }

        // Merge metadata distributions
        for (key, field_distribution) in other.metadata_distributions {
            let self_distribution = self.metadata_distributions.entry(key).or_default();
            for (field_key, field_value) in field_distribution {
                *self_distribution.entry(field_key).or_insert(0) += field_value;
            }
        }

        // Concatenate text
        self.aggregated_text.push_str(&other.aggregated_text);

        // Merge word counts
        for (key, value) in other.word_counts {
            *self.word_counts.entry(key).or_insert(0) += value;
        }

        // Merge n-gram counts
        for (key, value) in other.ngram_counts_2 {
            *self.ngram_counts_2.entry(key).or_insert(0) += value;
        }

        for (key, value) in other.ngram_counts_3 {
            *self.ngram_counts_3.entry(key).or_insert(0) += value;
        }

        // Merge numeric statistics
        self.total_text_length += other.total_text_length;
        self.sentence_count += other.sentence_count;
        self.document_lengths.extend(other.document_lengths);
        
        for (len, count) in other.word_lengths {
            *self.word_lengths.entry(len).or_insert(0) += count;
        }
        
        self.capitalized_words += other.capitalized_words;
        self.numeric_values.extend(other.numeric_values);
        
        for (lang, count) in other.languages_detected {
            *self.languages_detected.entry(lang).or_insert(0) += count;
        }
        
        for (punct, count) in other.punctuation_counts {
            *self.punctuation_counts.entry(punct).or_insert(0) += count;
        }
        
        self.paragraph_count += other.paragraph_count;
        self.empty_documents += other.empty_documents;
        
        for (decade, count) in other.date_decades {
            *self.date_decades.entry(decade).or_insert(0) += count;
        }
        
        for (field, count) in other.field_completeness {
            *self.field_completeness.entry(field).or_insert(0) += count;
        }
    }
}