"use client";
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Cookies from 'js-cookie';

interface SettingsPopupProps {
    onClose: () => void;
    position: { bottom: number; left: number };
}

export default function SettingsPopup({ onClose, position }: SettingsPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleLogout = async () => {
        try {
            Cookies.remove('debugflow_token');
            await signOut(auth);
            console.log('User signed out successfully');
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
        onClose();
    };

    const handleProfile = () => {
        // Placeholder for profile functionality
        console.log('Profile clicked');
        onClose();
    };

    return (
        <div
            ref={popupRef}
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-56 animate-slide-up"
            style={{
                bottom: `${position.bottom}px`,
                left: `${position.left}px`,
            }}
        >
            <div className="py-2">
                {/* Profile Option */}
                <button
                    onClick={handleProfile}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <UserCircleIcon className="w-5 h-5 text-gray-600" />
                    <span>Profile</span>
                </button>

                {/* Divider */}
                <div className="border-t border-gray-200 my-1"></div>

                {/* Logout Option */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
}
