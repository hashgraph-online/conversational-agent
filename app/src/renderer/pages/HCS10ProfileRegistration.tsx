import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import Typography from '../components/ui/Typography';
import { ProfileRegistrationForm } from '../components/hcs10/ProfileRegistrationForm';
import { RegistrationStatusDialog } from '../components/hcs10/RegistrationStatusDialog';
import { useHCS10Store } from '../stores/hcs10Store';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type {
  HCS10ProfileFormData,
  HCS10ProfileResponse,
} from '../../shared/schemas/hcs10';
import type { RegistrationProgressData } from '@hashgraphonline/standards-sdk';



export function HCS10ProfileRegistration() {
  const navigate = useNavigate();
  const { addProfile, profiles } = useHCS10Store();
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationResult, setRegistrationResult] =
    useState<HCS10ProfileResponse | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(
    null
  );
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [existingProfile, setExistingProfile] = useState<
    Partial<HCS10ProfileFormData> | undefined
  >();
  const [hasExistingProfile, setHasExistingProfile] = useState(false);

  const [registrationProgress, setRegistrationProgress] = useLocalStorage<{
    message: string;
    percent: number;
    stage?: string;
    state?: unknown;
    timestamp?: string;
  }>('hcs10-registration-progress', {
    message: '',
    percent: 0,
  });
  const [agentCreationState, setAgentCreationState, clearAgentCreationState] = useLocalStorage<unknown>(
    'hcs10-agent-creation-state',
    null
  );

  // Progress state for UI
  const [progress, setProgress] = useState<{
    message: string;
    percent: number;
    stage?: string;
  }>({ message: '', percent: 0 });

  /**
   * Check for existing profiles and fetch profile data
   */
  const fetchExistingProfile = useCallback(async () => {
    try {
      // Check if user has existing profiles in the store
      if (profiles && profiles.length > 0) {
        const profile = profiles[0]; // Get the first profile
        setHasExistingProfile(true);

        const storeFormData: Partial<HCS10ProfileFormData> = {
          name: profile.name,
          description: profile.description,
          capabilities: profile.capabilities,
          profileImage: profile.profileImage,
          logo: profile.profileImage,
          feeConfiguration: profile.feeConfiguration,
          socials: profile.socials || {
            twitter: '',
            github: '',
            website: '',
          },
          profileType: 'aiAgent',
          agentType: 'manual',
          creator: '',
          alias: '',
          version: '1.0.0',
          customProperties: {},
        };

        setExistingProfile(storeFormData);
      } else {
        setHasExistingProfile(false);
      }
    } catch (error) {
    }
  }, [profiles]);

  /**
   * Initialize existing profile data
   */
  useEffect(() => {
    fetchExistingProfile();
  }, [fetchExistingProfile]);

  /**
   * Clear cancelled/failed state on mount
   */
  useEffect(() => {
    if (registrationProgress.stage === 'cancelled' || registrationProgress.stage === 'failed') {
      const clearedProgress = {
        message: '',
        percent: 0,
      };
      setProgress(clearedProgress);
      setRegistrationProgress(clearedProgress);
      setIsRegistering(false);
      setRegistrationError(null);
      setRegistrationResult(null);
      setShowStatusDialog(false);
    }
  }, []); // Run only once on mount

  /**
   * Set up IPC listener for real-time progress updates
   */
  useEffect(() => {
    const handleProgressUpdate = (progressData: any) => {
      const updatedProgress = {
        message: progressData.message || `Stage: ${progressData.stage}`,
        percent: progressData.progressPercent || 0,
        stage: progressData.stage,
        timestamp: progressData.timestamp
      };
      
      setProgress(updatedProgress);
      setRegistrationProgress(updatedProgress);
      
      if (progressData.details?.state) {
        setAgentCreationState(progressData.details.state);
      }
    };

    const unsubscribe = window.electron.on('hcs10:registrationProgress', handleProgressUpdate);

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Load existing progress on component mount (only if valid in-progress state)
   */
  useEffect(() => {
    if (registrationProgress.percent > 0 && 
        registrationProgress.stage !== 'cancelled' && 
        registrationProgress.stage !== 'failed') {
      setProgress({
        message: registrationProgress.message,
        percent: registrationProgress.percent,
        stage: registrationProgress.stage,
      });
    }
  }, []);

  /**
   * Check for in-progress registration on mount
   */
  useEffect(() => {
    const checkInProgressRegistration = async () => {
      if (existingProfile?.name) {
        try {
          const result = await window.electron.invoke('hcs10:isRegistrationInProgress', existingProfile.name);
          if (result.success && result.data?.inProgress) {
            const progressResult = await window.electron.invoke('hcs10:getRegistrationProgress', existingProfile.name);
            if (progressResult.success && progressResult.data) {
              const state = progressResult.data;
              setProgress({
                message: `Resuming registration from ${state.currentStage}...`,
                percent: state.completedPercentage || 0,
                stage: state.currentStage
              });
              setAgentCreationState(state);
              setIsRegistering(true);
              setShowStatusDialog(true);
            }
          }
        } catch (error) {
        }
      }
    };

    checkInProgressRegistration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingProfile?.name]); // Intentionally exclude setAgentCreationState to prevent infinite loop

  /**
   * Handle form submission with real-time progress tracking
   */
  const handleSubmit = async (submittedFormData: HCS10ProfileFormData) => {
    setIsRegistering(true);
    setRegistrationError(null);
    setShowStatusDialog(true);
    
    const initialProgress = { 
      message: 'Preparing registration...', 
      percent: 0,
      timestamp: new Date().toISOString()
    };
    setProgress(initialProgress);
    setRegistrationProgress(initialProgress);

    try {
      const registrationData: Record<string, unknown> = {
        ...submittedFormData,
      };

      if (submittedFormData.logo && submittedFormData.logo.startsWith('data:')) {
        const mimeMatch = submittedFormData.logo.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const extension = mimeType.split('/')[1] || 'png';

        registrationData.profileImageFile = {
          data: submittedFormData.logo,
          name: `profile.${extension}`,
          type: mimeType,
        };
        delete registrationData.logo;
      } else if (submittedFormData.logo && submittedFormData.logo.startsWith('hcs://')) {
        registrationData.profileImage = submittedFormData.logo;
        delete registrationData.logo;
      }

      const result = await window.electron.invoke(
        'hcs10:registerProfile',
        registrationData
      );

      if (result.success && result.data) {
        setRegistrationResult(result.data);

        // Add to local store
        addProfile({
          id: `profile-${Date.now()}`,
          accountId: result.data.accountId,
          name: submittedFormData.name,
          description: submittedFormData.description,
          capabilities: submittedFormData.capabilities,
          socials: submittedFormData.socials,
          profileImage: submittedFormData.logo || submittedFormData.profileImage,
          feeConfiguration: submittedFormData.feeConfiguration,
          registeredAt: new Date(),
          lastUpdated: new Date(),
          status: 'active',
        });
        
        clearAgentCreationState();
      } else {
        const failedProgress = {
          message: 'Registration failed',
          percent: 0,
          stage: 'failed',
          timestamp: new Date().toISOString()
        };
        setProgress(failedProgress);
        setRegistrationProgress(failedProgress);
        setRegistrationError(result.error || 'Registration failed');
      }
    } catch (error) {
      const catchFailedProgress = {
        message: 'Registration failed',
        percent: 0,
        stage: 'failed',
        timestamp: new Date().toISOString()
      };
      setProgress(catchFailedProgress);
      setRegistrationProgress(catchFailedProgress);
      setRegistrationError(
        error instanceof Error ? error.message : 'Registration failed'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  /**
   * Handle dialog close
   */
  const handleCloseDialog = () => {
    setShowStatusDialog(false);
    
    if (isRegistering) {
      (async () => {
        try {
          await window.electron.invoke('hcs10:cancelRegistration');
          
          // Clear all registration state
          clearAgentCreationState();
          
          // Reset component state
          setIsRegistering(false);
          setRegistrationError(null);
          
          // Clear progress state completely - don't persist cancelled state
          const clearedProgress = {
            message: '',
            percent: 0,
          };
          setProgress(clearedProgress);
          setRegistrationProgress(clearedProgress);
          
        } catch (error) {
          // Even if cancellation fails, reset the local state
          clearAgentCreationState();
          setIsRegistering(false);
          setRegistrationError(null);
          
          const clearedProgress = {
            message: '',
            percent: 0,
          };
          setProgress(clearedProgress);
          setRegistrationProgress(clearedProgress);
        }
      })();
    } else if (registrationResult) {
      navigate('/');
    }
    
    setTimeout(() => {
      setRegistrationResult(null);
      setRegistrationError(null);
    }, 300);
  };

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-4 py-8 max-w-4xl'>
        {/* Header with breadcrumb */}
        <div className='mb-8'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => navigate('/')}
            className='mb-4 -ml-2'
          >
            <ArrowLeft className='h-4 w-4 mr-2' />
            Back to Home
          </Button>

          <div className='flex items-center gap-3 mb-2'>
            <div className='p-2 bg-orange-500/10 rounded-lg'>
              <User className='h-6 w-6 text-orange-500' />
            </div>
            <Typography variant='h1' className='text-3xl font-bold'>
              Profile Registration
            </Typography>
          </div>

          <Typography variant='body1' className='text-muted-foreground'>
            {hasExistingProfile
              ? 'Update your existing profile on the Hedera network. Your changes will replace the current profile information.'
              : 'Register your profile on the Hedera network to enable discovery and interaction with AI agents'}
          </Typography>

          {/* Existing Profile Notice */}
          {hasExistingProfile && (
            <div className='mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg'>
              <div className='flex items-center justify-between'>
                <div>
                  <Typography
                    variant='body1'
                    className='font-medium text-blue-700 dark:text-blue-300 mb-1'
                  >
                    You have an existing profile
                  </Typography>
                  <Typography
                    variant='body1'
                    className='text-sm text-blue-600 dark:text-blue-400'
                  >
                    Your existing profile data has been loaded below. Make any
                    changes you'd like and save to update.
                  </Typography>
                </div>
              </div>
            </div>
          )}

          {/* Registration State Reset */}
          {(registrationProgress.percent > 0 || agentCreationState) && (
            <div className='mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg'>
              <div className='flex items-center justify-between'>
                <div>
                  <Typography
                    variant='body1'
                    className='font-medium text-amber-700 dark:text-amber-300 mb-1'
                  >
                    Previous registration in progress
                  </Typography>
                  <Typography
                    variant='body1'
                    className='text-sm text-amber-600 dark:text-amber-400'
                  >
                    A previous registration attempt was detected. If you're experiencing issues, you can reset the registration progress while keeping your form data.
                  </Typography>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={async () => {
                    try {
                      // Clear backend state files
                      await window.electron.invoke('hcs10:clearAllStates');
                      
                      // Clear only registration state, not form data
                      clearAgentCreationState();
                      setRegistrationProgress({
                        message: '',
                        percent: 0,
                      });
                      setProgress({
                        message: '',
                        percent: 0,
                      });
                      setRegistrationError(null);
                      setRegistrationResult(null);
                      // Don't clear existingProfile - keep the form data
                    } catch (error) {
                      console.error('Failed to reset registration state:', error);
                    }
                  }}
                  className='ml-4'
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Registration Form */}
        <div className='bg-card rounded-lg border shadow-sm'>
          <div className='p-6'>
            <ProfileRegistrationForm
              onSubmit={handleSubmit}
              isSubmitting={isRegistering}
              existingData={existingProfile}
              progress={progress.percent >= 0 && progress.message ? progress : undefined}
              network={'testnet'}
            />
          </div>
        </div>

        {/* Status Dialog */}
        <RegistrationStatusDialog
          isOpen={showStatusDialog}
          onClose={handleCloseDialog}
          isRegistering={isRegistering}
          result={registrationResult}
          error={registrationError}
          progress={progress.percent >= 0 && progress.message ? progress : undefined}
        />
      </div>
    </div>
  );
}
