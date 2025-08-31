import React from 'react';
import { AdminInterface } from '../../components/knowledge-base/admin/AdminInterface';

const AdminPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminInterface />
    </div>
  );
};

export default AdminPage;