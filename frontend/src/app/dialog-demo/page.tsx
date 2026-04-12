"use client";

import React from 'react';
import { useDialog } from '@/components/providers/DialogProvider';

export default function DialogBoxDemo() {
  const dialog = useDialog();

  const demos = [
    {
      label: 'Alert',
      action: () => dialog.alert('Alert', 'This is a simple alert message.')
    },
    {
      label: 'Confirm',
      action: async () => {
        const result = await dialog.confirm('Confirm Action', 'Do you want to proceed with this action?');
        if (result) alert('You confirmed!');
      }
    },
    {
      label: 'Dangerous Confirm',
      action: async () => {
        const result = await dialog.confirm('Delete Item?', 'This action cannot be undone. Are you sure?', true);
        if (result) alert('Item deleted!');
      }
    },
    {
      label: 'Prompt',
      action: async () => {
        const result = await dialog.prompt('Enter Your Name', 'Please type your name below:', 'John Doe', 'Your name here');
        if (result) alert(`Hello, ${result}!`);
      }
    },
    {
      label: 'Info',
      action: () => dialog.info('Information', 'This is an informational message with important details.')
    },
    {
      label: 'Success',
      action: () => dialog.success('Success!', 'Your changes have been saved successfully.')
    },
    {
      label: 'Error',
      action: () => dialog.error('Error', 'Something went wrong. Please try again later.')
    },
    {
      label: 'Warning',
      action: () => dialog.warning('Warning', 'Please proceed with caution. This may have consequences.')
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Dialog Box Component Demo</h1>
          <p className="text-white/60">Click any button below to see the different dialog types</p>
        </div>

        {/* Demo Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {demos.map((demo, index) => (
            <button
              key={index}
              onClick={demo.action}
              className="px-4 py-3 bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 backdrop-blur-sm border border-red-400/30 text-red-200 rounded-xl transition-all duration-200 hover:scale-105 font-medium"
            >
              {demo.label}
            </button>
          ))}
        </div>

        {/* Documentation */}
        <div className="mt-12 bg-white/5 border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Usage Guide</h2>
          <p className="text-white/60 mb-4">
            The DialogBox component replaces native JavaScript alert() and confirm() functions with beautiful, customizable modals.
          </p>
          <div className="space-y-4 text-white/60 text-sm">
            <div>
              <h3 className="font-semibold text-white mb-2">Features:</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Multiple dialog types: alert, confirm, prompt, info, success, error, warning</li>
                <li>Beautiful glassmorphism design matching your theme</li>
                <li>Promise-based API for easy async/await usage</li>
                <li>Keyboard support (Enter to confirm, Escape to cancel)</li>
                <li>Smooth animations and transitions</li>
                <li>Support for dangerous actions with red styling</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Setup:</h3>
              <p className="ml-2">Wrap your app with DialogProvider in the root layout file</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Usage:</h3>
              <p className="ml-2">Import useDialog hook and call dialog methods in components</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
