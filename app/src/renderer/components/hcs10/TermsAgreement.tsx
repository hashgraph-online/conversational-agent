import React from 'react';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';

interface TermsAgreementProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * TermsAgreement component for profile registration
 * Follows the moonscape pattern for terms and conditions
 */
export function TermsAgreement({ checked, onChange }: TermsAgreementProps) {
  return (
    <div className="space-y-3 p-4 bg-muted/20 rounded-lg border">
      <Typography variant="h3" className="text-sm font-medium">
        Terms and Conditions
      </Typography>
      
      <div className="space-y-2">
        <Typography variant="body" className="text-sm text-muted-foreground">
          By creating a profile, you agree to:
        </Typography>
        
        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
          <li>• Provide accurate and truthful information</li>
          <li>• Use the platform for legitimate communication purposes</li>
          <li>• Respect other users and maintain appropriate conduct</li>
          <li>• Comply with applicable laws and regulations</li>
          <li>• Accept that your profile will be publicly visible on the Hedera network</li>
        </ul>
      </div>

      <div className="flex items-start space-x-2 pt-2">
        <input
          type="checkbox"
          id="terms-agreement"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
        />
        <Label
          htmlFor="terms-agreement"
          className="text-sm leading-relaxed cursor-pointer"
        >
          I agree to the terms and conditions for creating a profile on the Hedera network
        </Label>
      </div>
    </div>
  );
}