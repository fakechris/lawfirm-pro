import React from 'react';
import { KnowledgePortal } from '../../components/knowledge-base/KnowledgePortal';

const KnowledgeBasePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <KnowledgePortal />
    </div>
  );
};

export default KnowledgeBasePage;