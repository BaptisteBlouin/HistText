import React, { useState, useRef, useEffect } from 'react';
import styles from '../css/AliasSelector.module.css';
import { ChevronDown, Info, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

import config from '../../../config.json';

interface AliasSelectorProps {
  aliases: string[];
  selectedAlias: string;
  onAliasChange: (alias: string) => void;
  descriptions: Record<string, string>;
}

const AliasSelector: React.FC<AliasSelectorProps> = ({
  aliases,
  selectedAlias,
  onAliasChange,
  descriptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated } = useAuth();

  // State for tooltip positioning and content
  const [tooltipContent, setTooltipContent] = useState('');
  const [tooltipTitle, setTooltipTitle] = useState('');
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Ref for the container to get proper positioning
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter aliases based on search term
  const filteredAliases = aliases.filter(alias =>
    alias.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus on the search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);

  const handleInfoMouseEnter = (alias: string, event: React.MouseEvent) => {
    event.stopPropagation();

    const description = descriptions[alias];
    if (description) {
      // Calculate position relative to the container
      if (containerRef.current && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        setTooltipPosition({
          top: rect.top - containerRect.top + rect.height + 5,
          left: rect.left - containerRect.left,
        });
      }

      setTooltipTitle(alias);
      setTooltipContent(description);
      setTooltipVisible(true);
    }
  };

  const handleInfoMouseLeave = (event: React.MouseEvent) => {
    event.stopPropagation();
    setTooltipVisible(false);
  };

  // Handle option selection
  const handleOptionClick = (alias: string) => {
    onAliasChange(alias);
    setIsOpen(false);
    setSearchTerm(''); // Clear search when selecting
  };

  // Handle input change for filtering
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Custom tooltip component
  const Tooltip = () => {
    if (!tooltipVisible) return null;

    const tooltipStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${tooltipPosition.top}px`,
      left: `${tooltipPosition.left}px`,
      zIndex: 1000,
      backgroundColor: 'white',
      boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      padding: '0.5rem',
      maxWidth: '40rem',
      minWidth: '40rem',
      lineHeight: '2rem',
    };

    const titleStyle: React.CSSProperties = {
      fontWeight: 'bold',
      fontSize: '1.25rem',
      marginBottom: '0.25rem',
    };

    const contentStyle: React.CSSProperties = {
      fontSize: '1rem',
    };

    return (
      <div
        style={tooltipStyle}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
      >
        <div style={titleStyle}>{tooltipTitle}</div>
        <div style={contentStyle}>{tooltipContent}</div>
      </div>
    );
  };

  // Custom styles for search input
  const searchContainerStyle: React.CSSProperties = {
    padding: '8px',
    borderBottom: '1px solid #eaeaea',
    position: 'sticky',
    top: 0,
    backgroundColor: 'white',
    zIndex: 1,
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
  };

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    right: '16px',
    transform: 'translateY(-50%)',
    color: '#999',
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {isAuthenticated ? (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div className={styles.selector} onClick={() => setIsOpen(!isOpen)}>
            <span className={styles.selectorText}>
              {selectedAlias || config.collection_selector_sentence}
            </span>
            <ChevronDown className={`${styles.icon} ${isOpen ? styles.iconRotate : ''}`} />
          </div>
          {isOpen && (
            <div className={styles.dropdown}>
              {/* Search filter input */}
              <div style={searchContainerStyle}>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    style={searchInputStyle}
                    onClick={e => e.stopPropagation()}
                  />
                  <Search size={16} style={searchIconStyle} />
                </div>
              </div>
              <div className={styles.dropdownScroll}>
                <div className={styles.option} onClick={() => handleOptionClick('')}>
                  {config.collection_selector_sentence}
                </div>
                {filteredAliases.map(alias => (
                  <div
                    key={alias}
                    className={styles.option}
                    onClick={() => handleOptionClick(alias)}
                  >
                    <span>{alias}</span>
                    <div
                      className={styles.infoIconContainer}
                      style={{
                        padding: '10px',
                        margin: '-10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => handleInfoMouseEnter(alias, e)}
                      onMouseLeave={handleInfoMouseLeave}
                      onClick={e => e.stopPropagation()}
                    >
                      <Info className={styles.infoIcon} />
                    </div>
                  </div>
                ))}
                {filteredAliases.length === 0 && (
                  <div className={styles.option} style={{ color: '#999', fontStyle: 'italic' }}>
                    No matches found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom tooltip component */}
          <Tooltip />
        </div>
      ) : (
        <p></p>
      )}
    </div>
  );
};

export default AliasSelector;
