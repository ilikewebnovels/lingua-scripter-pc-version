import React from 'react';
import { LoadingSpinner } from './icons';

/**
 * Modal loading fallback for Suspense boundaries
 */
const ModalLoader: React.FC = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <LoadingSpinner />
    </div>
);

export default ModalLoader;
