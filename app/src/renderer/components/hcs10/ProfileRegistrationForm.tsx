import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormPersistence } from '../../hooks/useFormPersistence';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import Typography from '../ui/Typography';
import { AgentLogoSelector } from './AgentLogoSelector';
import { CapabilitiesSelector } from './CapabilitiesSelector';
import { SocialLinksManager } from './SocialLinksManager';
import { ProgressBar } from './ProgressBar';
import {
  type HCS10ProfileFormData,
  HCS10ProfileSchema,
} from '../../../shared/schemas/hcs10';
import { Loader2, DollarSign, User, Bot } from 'lucide-react';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';

interface ProfileRegistrationFormProps {
  onSubmit: (data: HCS10ProfileFormData) => void | Promise<void>;
  isSubmitting?: boolean;
  existingData?: Partial<HCS10ProfileFormData>;
  progress?: {
    message: string;
    percent: number;
    stage?: string;
  };
  network?: 'mainnet' | 'testnet';
}

/**
 * Form component for HCS-10 profile registration
 */
export function ProfileRegistrationForm({
  onSubmit,
  isSubmitting = false,
  existingData,
  progress,
  network = 'testnet',
}: ProfileRegistrationFormProps) {
  const [showFeeConfig, setShowFeeConfig] = useState(false);
  const [feeType, setFeeType] = useState<'hbar' | 'token'>('hbar');

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<HCS10ProfileFormData>({
    resolver: zodResolver(HCS10ProfileSchema),
    defaultValues: {
      name: existingData?.name || '',
      description: existingData?.description || '',
      profileType: existingData?.profileType || 'aiAgent',
      alias: existingData?.alias || '',
      creator: existingData?.creator || '',
      version: existingData?.version || '1.0.0',
      agentType: existingData?.agentType || 'manual',
      capabilities: existingData?.capabilities || [],
      socials: existingData?.socials || {
        twitter: '',
        github: '',
        website: '',
      },
      profileImage: existingData?.profileImage || undefined,
      logo: existingData?.logo || '',
      feeConfiguration: existingData?.feeConfiguration || undefined,
      customProperties: existingData?.customProperties || {},
    },
});

  // Watch form values (must be defined early as they're used in JSX)
  const capabilities = watch('capabilities');
  const socials = watch('socials');
  const logo = watch('logo');
  const profileType = watch('profileType');

  // Form persistence with localStorage
  const { saveToStorage, clearPersistedData } = useFormPersistence(
    'hcs10_profile_form',
    watch,
    setValue,
    ['name', 'description', 'creator', 'alias', 'profileType', 'agentType', 'capabilities', 'socials', 'logo', 'profileImage']
  );

  // Auto-save form data when it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToStorage();
    }, 1000); // Save 1 second after user stops typing

    return () => clearTimeout(timer);
  }, [watch('name'), watch('description'), watch('creator'), watch('alias'), profileType, watch('agentType'), capabilities, socials, logo, saveToStorage]);

  /**
   * Handle form submission with persistence cleanup
   */
  const handleFormSubmit = useCallback(async (data: HCS10ProfileFormData) => {
    try {
      await onSubmit(data);
      // Clear persisted data on successful submission
      clearPersistedData();
    } catch (error) {
      // Keep persisted data if submission fails
      console.error('Form submission failed:', error);
      throw error;
    }
  }, [onSubmit, clearPersistedData]);

  /**
   * Handle profile type change
   */
  const handleProfileTypeChange = useCallback(
    (value: 'person' | 'aiAgent') => {
      setValue('profileType', value);

      // Reset AI agent specific fields when switching to person
      if (value === 'person') {
        setValue('agentType', undefined);
        setValue('capabilities', []);
      }
    },
    [setValue]
  );

  /**
   * Handle social links change (object format like moonscape)
   */
  const handleSocialChange = useCallback(
    (key: 'twitter' | 'github' | 'website', value: string) => {
      setValue(`socials.${key}` as any, value);
    },
    [setValue]
  );

  /**
   * Handle logo change from AgentLogoSelector
   */
  const handleLogoChange = useCallback(
    (value: string) => {
      setValue('logo', value);
      setValue('profileImage', value); // Keep both for compatibility
    },
    [setValue]
  );

  /**
   * Handle terms agreement change
   */

  /**
   * Check if form is valid
   */
  const isFormValid = React.useMemo(() => {
    const name = watch('name');
    const description = watch('description');
    const creator = watch('creator');

    const basicValid =
      name?.length >= 3 &&
      description?.length >= 10 &&
      creator?.length >= 2;

    if (profileType === 'person') {
      console.log('🔍 Person profile validation:', { 
        name: name?.length, 
        description: description?.length, 
        creator: creator?.length, 
        profileType,
        basicValid,
        result: basicValid
      });
      return basicValid;
    } else {
      const capabilitiesValid = capabilities?.length > 0 && capabilities.length <= 5;
      console.log('🔍 AI Agent validation:', { 
        name: name?.length, 
        description: description?.length, 
        creator: creator?.length, 
        profileType,
        capabilities: capabilities?.length,
        capabilitiesArray: capabilities,
        basicValid, 
        capabilitiesValid,
        result: basicValid && capabilitiesValid
      });
      return basicValid && capabilitiesValid;
    }
  }, [watch('name'), watch('description'), watch('creator'), profileType, capabilities]);

  // Debug log for button state
  console.log('🚀 Button state:', { 
    isSubmitting, 
    isFormValid, 
    buttonDisabled: isSubmitting || !isFormValid,
    profileType 
  });

  // Debug all form values
  console.log('📋 All form values:', {
    name: watch('name'),
    description: watch('description'), 
    creator: watch('creator'),
    capabilities: watch('capabilities'),
    profileType: watch('profileType')
  });

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-8'>
      {/* Progress Bar */}
      {progress && (
        <ProgressBar
          message={progress.message}
          percent={progress.percent}
          stage={progress.stage}
        />
      )}

      {/* Profile Type Selection */}
      <div className='space-y-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700'>
        <Typography variant='h3' className='text-lg font-semibold'>
          Profile Type
        </Typography>
        <div className='space-y-2'>
          <Label>Select Profile Type</Label>
          <Controller
            name='profileType'
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleProfileTypeChange(value as 'person' | 'aiAgent');
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger className='w-full md:w-64'>
                  <SelectValue placeholder='Select profile type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='person'>
                    <div className='flex items-center gap-2'>
                      <User className='h-4 w-4' />
                      Human Profile
                    </div>
                  </SelectItem>
                  <SelectItem value='aiAgent'>
                    <div className='flex items-center gap-2'>
                      <Bot className='h-4 w-4' />
                      AI Agent Profile
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {watch('profileType') === 'person' && (
            <Typography variant='body1' className='text-sm text-muted-foreground'>
              Create a personal profile to communicate with AI agents
            </Typography>
          )}
          {watch('profileType') === 'aiAgent' && (
            <Typography variant='body1' className='text-sm text-muted-foreground'>
              Create an AI agent profile to be discoverable by users
            </Typography>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className='space-y-6'>
        <Typography variant='h3' className='text-lg font-semibold'>
          Basic Information
        </Typography>

        {/* Name */}
        <div className='space-y-3'>
          <Label htmlFor='name'>
            {watch('profileType') === 'person' ? 'Your Display Name' : 'Agent Name'} *
          </Label>
          <Input
            id='name'
            placeholder={
              watch('profileType') === 'person'
                ? 'e.g., John Smith'
                : 'e.g., CodeAssistant'
            }
            disabled={isSubmitting}
            {...register('name')}
            className={cn(errors.name && 'border-destructive')}
          />
          {errors.name && (
            <Typography variant='body1' className='text-sm text-destructive'>
              {errors.name.message}
            </Typography>
          )}
        </div>

        {/* Alias/Username */}
        <div className='space-y-3'>
          <Label htmlFor='alias'>
            {watch('profileType') === 'person' ? 'Username' : 'Agent Username'}
          </Label>
          <Input
            id='alias'
            placeholder={
              watch('profileType') === 'person'
                ? 'e.g., john_smith'
                : 'e.g., code_assistant'
            }
            disabled={isSubmitting}
            {...register('alias')}
            className={cn(errors.alias && 'border-destructive')}
          />
          {errors.alias && (
            <Typography variant='body1' className='text-sm text-destructive'>
              {errors.alias.message}
            </Typography>
          )}
          <Typography variant='body1' className='text-xs text-muted-foreground'>
            Optional. Used for identification in URLs and mentions. Letters, numbers, and underscores only.
          </Typography>
        </div>

        {/* Creator/Organization */}
        <div className='space-y-3'>
          <Label htmlFor='creator'>Organization *</Label>
          <Input
            id='creator'
            placeholder='e.g., Your Company Name'
            disabled={isSubmitting}
            {...register('creator')}
            className={cn(errors.creator && 'border-destructive')}
          />
          {errors.creator && (
            <Typography variant='body1' className='text-sm text-destructive'>
              {errors.creator.message}
            </Typography>
          )}
        </div>

        {/* Description */}
        <div className='space-y-3'>
          <Label htmlFor='description'>
            {watch('profileType') === 'person' ? 'Bio' : 'Agent Bio'} *
          </Label>
          <Textarea
            id='description'
            placeholder={
              watch('profileType') === 'person'
                ? 'Describe yourself, your interests, and what you want to do with AI agents...'
                : 'Describe your AI agent, its purpose, and capabilities...'
            }
            rows={4}
            disabled={isSubmitting}
            {...register('description')}
            className={cn(errors.description && 'border-destructive')}
          />
          {errors.description && (
            <Typography variant='body1' className='text-sm text-destructive'>
              {errors.description.message}
            </Typography>
          )}
        </div>

        {/* Profile Image using HCS-11 */}
        <div className='space-y-3'>
          <Label>Profile Picture</Label>
          <div className='p-4 bg-muted/20 rounded-lg border'>
            <AgentLogoSelector
              onChange={handleLogoChange}
              formData={logo || ''}
              network={network}
            />
          </div>
        </div>
      </div>

      {/* AI Agent Specific Fields */}
      {profileType === 'aiAgent' && (
        <>
          {/* Agent Type */}
          <div className='space-y-6'>
            <Typography variant='h3' className='text-lg font-semibold'>
              Communication Style
            </Typography>
            <div className='space-y-2'>
              <Label>Agent Type</Label>
              <Controller
                name='agentType'
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className='w-full md:w-64'>
                      <SelectValue placeholder='Select agent type' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='autonomous'>Autonomous</SelectItem>
                      <SelectItem value='manual'>Manual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Tags/Topics */}
          <div className='space-y-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700'>
            <Typography variant='h3' className='text-lg font-semibold'>
              Agent Capabilities
            </Typography>
            <Typography
              variant='body1'
              className='text-sm text-muted-foreground italic'
            >
              Select the capabilities that your agent provides
            </Typography>
            <Controller
              name='capabilities'
              control={control}
              render={({ field }) => (
                <CapabilitiesSelector
                  value={field.value || []}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  error={errors.capabilities?.message}
                />
              )}
            />
            {errors.capabilities && (
              <Typography variant='body1' className='text-sm text-destructive'>
                {errors.capabilities.message}
              </Typography>
            )}
          </div>

          {/* Capabilities (hidden field that gets auto-populated) */}
          <Controller
            name='capabilities'
            control={control}
            render={({ field }) => (
              <input
                type='hidden'
                {...field}
                value={field.value?.join(',') || ''}
              />
            )}
          />
        </>
      )}

      {/* Social Links (Object format like moonscape) */}
      <div className='space-y-6'>
        <Typography variant='h3' className='text-lg font-semibold'>
          Social Links{' '}
          <span className='text-muted-foreground font-normal'>(optional)</span>
        </Typography>
<div className='space-y-4'>
            <div className='space-y-3'>
              <Label htmlFor='twitter'>Twitter/X</Label>            <Input
              id='twitter'
              placeholder='https://twitter.com/username'
              disabled={isSubmitting}
              value={socials?.twitter || ''}
              onChange={(e) => handleSocialChange('twitter', e.target.value)}
              className={cn(errors.socials?.twitter && 'border-destructive')}
            />
          </div>
<div className='space-y-3'>
              <Label htmlFor='github'>GitHub</Label>            <Input
              id='github'
              placeholder='https://github.com/username'
              disabled={isSubmitting}
              value={socials?.github || ''}
              onChange={(e) => handleSocialChange('github', e.target.value)}
              className={cn(errors.socials?.github && 'border-destructive')}
            />
          </div>
<div className='space-y-3'>
              <Label htmlFor='website'>Website</Label>            <Input
              id='website'
              placeholder='https://example.com'
              disabled={isSubmitting}
              value={socials?.website || ''}
              onChange={(e) => handleSocialChange('website', e.target.value)}
              className={cn(errors.socials?.website && 'border-destructive')}
            />
          </div>
        </div>
      </div>

      {/* Fee Configuration */}
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <Typography variant='h3' className='text-lg font-semibold'>
            Fee Configuration
          </Typography>
          <div className='flex items-center gap-2'>
            <Label htmlFor='enable-fees' className='text-sm cursor-pointer'>
              Enable fees
            </Label>
            <Switch
              id='enable-fees'
              checked={showFeeConfig}
              onCheckedChange={setShowFeeConfig}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {showFeeConfig && (
          <div className='space-y-6 p-6 bg-gray-100 dark:bg-gray-800/50 rounded-2xl'>
            <div className='flex gap-2'>
              <Button
                type='button'
                variant={feeType === 'hbar' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setFeeType('hbar')}
                disabled={isSubmitting}
              >
                <DollarSign className='h-4 w-4 mr-1' />
                HBAR Fee
              </Button>
              <Button
                type='button'
                variant={feeType === 'token' ? 'default' : 'outline'}
                size='sm'
                onClick={() => setFeeType('token')}
                disabled={isSubmitting}
              >
                Token Fee
              </Button>
            </div>

            {feeType === 'hbar' ? (
              <div className='space-y-3'>
                <Label htmlFor='hbarFee'>HBAR Amount</Label>
                <Input
                  id='hbarFee'
                  type='number'
                  step='0.01'
                  min='0'
                  placeholder='0.00'
                  disabled={isSubmitting}
                  {...register('feeConfiguration.hbarFee', {
                    valueAsNumber: true,
                  })}
                />
              </div>
            ) : (
              <div className='space-y-6'>
                <div className='space-y-3'>
                  <Label htmlFor='tokenId'>Token ID</Label>
                  <Input
                    id='tokenId'
                    placeholder='0.0.12345'
                    disabled={isSubmitting}
                    {...register('feeConfiguration.tokenFee.tokenId')}
                  />
                </div>
                <div className='space-y-3'>
                  <Label htmlFor='tokenAmount'>Token Amount</Label>
                  <Input
                    id='tokenAmount'
                    type='number'
                    step='0.01'
                    min='0'
                    placeholder='0.00'
                    disabled={isSubmitting}
                    {...register('feeConfiguration.tokenFee.amount', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className='flex gap-4 pt-6'>
        <Button
          type='button'
          variant='outline'
          onClick={() => {
            reset();
            clearPersistedData();
          }}
          disabled={isSubmitting}
        >
          Clear Form
        </Button>
        <Button
          type='submit'
          className='flex-1'
          size='lg'
          disabled={isSubmitting || !isFormValid}
        >
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {watch('profileType') === 'person'
                ? 'Creating Profile...'
                : 'Registering Agent...'}
            </>
          ) : watch('profileType') === 'person' ? (
            'Create Profile'
          ) : (
            'Register Agent Profile'
          )}
        </Button>
      </div>
    </form>
  );
}
