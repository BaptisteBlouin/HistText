// app/frontend/src/containers/components/NERDisplay/NERInsights.tsx
import React, { useState, useCallback } from 'react';
import { Box, Typography, Tabs, Tab, Badge } from '@mui/material';
import { 
  Insights, 
  TrendingUp, 
  Hub, 
  Assessment, 
  Analytics, 
  Psychology,
  Science
} from '@mui/icons-material';
import { useNERStatistics } from './hooks/useNERStatistics';
import ProcessingBanner from './components/ProcessingBanner';
import FeatureAvailabilityIndicator from './components/FeatureAvailabilityIndicator';
import NERInsightsHeader from './components/NERInsightsHeader';
import NERInsightsKeyMetrics from './components/NERInsightsKeyMetrics';
import TopEntitiesTab from './components/tabs/TopEntitiesTab';
import RelationshipsTab from './components/tabs/RelationshipsTab';
import DistributionTab from './components/tabs/DistributionTab';
import DocumentAnalysisTab from './components/tabs/DocumentAnalysisTab';
import PatternsTab from './components/tabs/PatternsTab';
import AdvancedAnalyticsTab from './components/tabs/AdvancedAnalyticsTab';
import { NERInsightsProps, TabPanelProps } from './types/ner-insights-types';

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const NERInsights: React.FC<NERInsightsProps> = ({ 
  nerData, 
  selectedAlias, 
  onDocumentClick,
  entityLimit,
  entities = []
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  
  // Use the optimized hook
  const { stats, processingState, isProcessing } = useNERStatistics(nerData, entityLimit);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // Handle document click
  const handleDocumentClick = useCallback((documentId: string) => {
    if (onDocumentClick) {
      onDocumentClick(documentId);
    }
  }, [onDocumentClick]);

  if (!stats) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2">
          No NER data available for analysis. Run a query with NER enabled to see insights.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <NERInsightsHeader 
        selectedAlias={selectedAlias}
        isProcessing={isProcessing}
        stats={stats}
      />

      {/* Processing Banner */}
      <ProcessingBanner 
        processingState={processingState}
        isProcessing={isProcessing}
        stats={stats}
      />

      {/* Key Metrics Overview */}
      <NERInsightsKeyMetrics stats={stats} />

      {/* Enhanced Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab 
            icon={<TrendingUp />} 
            label="Top Entities" 
            iconPosition="start"
          />
          <Tab 
            icon={
              <Badge badgeContent="Enhanced" color="success" variant="dot">
                <Hub />
              </Badge>
            } 
            label="Relationships" 
            iconPosition="start"
          />
          <Tab 
            icon={<Assessment />} 
            label="Distribution" 
            iconPosition="start"
          />
          <Tab 
            icon={<Analytics />} 
            label="Document Analysis" 
            iconPosition="start"
          />
          <Tab 
            icon={
              <Badge badgeContent="Improved" color="primary" variant="dot">
                <Psychology />
              </Badge>
            } 
            label="Patterns" 
            iconPosition="start"
          />
          <Tab 
            icon={
              <Badge badgeContent="NEW" color="success" variant="dot">
                <Science />
              </Badge>
            } 
            label="Deep Analytics" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <TopEntitiesTab 
          stats={stats}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <RelationshipsTab 
          stats={stats}
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <DistributionTab 
          stats={stats}
          onDocumentClick={handleDocumentClick}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <DocumentAnalysisTab 
          stats={stats}
          onDocumentClick={handleDocumentClick}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={4}>
        <PatternsTab stats={stats} />
      </TabPanel>

      <TabPanel value={activeTab} index={5}>
        <AdvancedAnalyticsTab 
          stats={stats}
          entities={entities}
          onDocumentClick={handleDocumentClick}
        />
      </TabPanel>
    </Box>
  );
};

export default React.memo(NERInsights);