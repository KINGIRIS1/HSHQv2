import React from 'react';
import { User, Employee } from '../types';
import VaoSoView from './archive/VaoSoView';

interface RegistrationRecordsProps {
  currentUser: User;
  wards: string[];
  employees?: Employee[];
}

const RegistrationRecords: React.FC<RegistrationRecordsProps> = ({
  currentUser,
  wards,
}) => {
  return <VaoSoView currentUser={currentUser} wards={wards} />;
};

export default RegistrationRecords;

