// components/SolrDatabaseSelector.tsx

import React, { useState, useRef, useEffect } from 'react';
import styles from '../css/AliasSelector.module.css';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import config from '../../../config.json';

interface SolrDatabase {
  id: number;
  name: string;
  local_port: number;
  // Add other fields if necessary
}

interface SolrDatabaseSelectorProps {
  solrDatabases: SolrDatabase[];
  selectedSolrDatabase: SolrDatabase | null;
  onSolrDatabaseChange: (database: SolrDatabase | null) => void;
}

const SolrDatabaseSelector: React.FC<SolrDatabaseSelectorProps> = ({
  solrDatabases,
  selectedSolrDatabase,
  onSolrDatabaseChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.container} ref={dropdownRef}>
      {isAuthenticated ? (
        <div>
          <div className={styles.selector} onClick={() => setIsOpen(!isOpen)}>
            <span className={styles.selectorText}>
              {selectedSolrDatabase ? selectedSolrDatabase.name : config.solr_selector_sentence}
            </span>
            <ChevronDown className={`${styles.icon} ${isOpen ? styles.iconRotate : ''}`} />
          </div>
          {isOpen && (
            <div className={styles.dropdown}>
              <div className={styles.dropdownScroll}>
                <div
                  className={styles.option}
                  onClick={() => {
                    onSolrDatabaseChange(null);
                    setIsOpen(false);
                  }}
                >
                  {config.solr_selector_sentence}
                </div>
                {solrDatabases.map(database => (
                  <div
                    key={database.id}
                    className={styles.option}
                    onClick={() => {
                      onSolrDatabaseChange(database);
                      setIsOpen(false);
                    }}
                  >
                    <span>{database.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p>Please log in.</p>
      )}
    </div>
  );
};

export default SolrDatabaseSelector;
