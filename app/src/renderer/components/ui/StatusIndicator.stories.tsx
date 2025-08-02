import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator } from './StatusIndicator';

const meta: Meta<typeof StatusIndicator> = {
  title: 'UI/StatusIndicator',
  component: StatusIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['online', 'offline', 'connecting', 'error', 'warning'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    labelPosition: {
      control: 'select',
      options: ['left', 'right', 'top', 'bottom'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: {
    status: 'online',
  },
};

export const Offline: Story = {
  args: {
    status: 'offline',
  },
};

export const Connecting: Story = {
  args: {
    status: 'connecting',
  },
};

export const Error: Story = {
  args: {
    status: 'error',
  },
};

export const Warning: Story = {
  args: {
    status: 'warning',
  },
};

export const WithLabel: Story = {
  args: {
    status: 'online',
    label: 'Connected',
  },
};

export const LabelLeft: Story = {
  args: {
    status: 'online',
    label: 'Status',
    labelPosition: 'left',
  },
};

export const LabelTop: Story = {
  args: {
    status: 'online',
    label: 'Status',
    labelPosition: 'top',
  },
};

export const LabelBottom: Story = {
  args: {
    status: 'online',
    label: 'Status',
    labelPosition: 'bottom',
  },
};

export const Small: Story = {
  args: {
    status: 'online',
    size: 'sm',
    label: 'Small',
  },
};

export const Large: Story = {
  args: {
    status: 'online',
    size: 'lg',
    label: 'Large',
  },
};

export const WithTooltip: Story = {
  args: {
    status: 'online',
    tooltip: 'Server is operational',
  },
};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <StatusIndicator status="online" label="Online" />
      <StatusIndicator status="offline" label="Offline" />
      <StatusIndicator status="connecting" label="Connecting" />
      <StatusIndicator status="error" label="Error" />
      <StatusIndicator status="warning" label="Warning" />
    </div>
  ),
};