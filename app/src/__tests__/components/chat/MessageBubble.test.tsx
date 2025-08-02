import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessageBubble from '../../../renderer/components/chat/MessageBubble';
import type { Message } from '../../../renderer/stores/agentStore';

describe('MessageBubble', () => {
  const baseMessage: Message = {
    id: 'test-1',
    role: 'user',
    content: 'Hello, world!',
    timestamp: new Date('2023-01-01T12:00:00Z')
  };

  it('should render user message correctly', () => {
    render(<MessageBubble message={baseMessage} />);
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
  });

  it('should render assistant message correctly', () => {
    const assistantMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: 'Hello! How can I help you?'
    };
    
    render(<MessageBubble message={assistantMessage} />);
    
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
  });

  it('should render system message correctly', () => {
    const systemMessage: Message = {
      ...baseMessage,
      role: 'system',
      content: 'Connected to Hedera testnet'
    };
    
    render(<MessageBubble message={systemMessage} />);
    
    expect(screen.getByText('Connected to Hedera testnet')).toBeInTheDocument();
  });

  it('should display transaction ID when present in metadata', () => {
    const messageWithTransaction: Message = {
      ...baseMessage,
      metadata: {
        transactionId: '0.0.123456@1640995200.123456789'
      }
    };
    
    render(<MessageBubble message={messageWithTransaction} />);
    
    expect(screen.getByText('0.0.1234...')).toBeInTheDocument();
  });

  it('should display transaction notes when present in metadata', () => {
    const messageWithNotes: Message = {
      ...baseMessage,
      role: 'assistant',
      metadata: {
        notes: ['Transaction successful', 'Fee: 0.0001 HBAR']
      }
    };
    
    render(<MessageBubble message={messageWithNotes} />);
    
    expect(screen.getByText('Transaction Details:')).toBeInTheDocument();
    expect(screen.getByText('• Transaction successful')).toBeInTheDocument();
    expect(screen.getByText('• Fee: 0.0001 HBAR')).toBeInTheDocument();
  });

  it('should format timestamp correctly', () => {
    const messageWithTime: Message = {
      ...baseMessage,
      timestamp: new Date('2023-06-15T14:30:45Z')
    };
    
    render(<MessageBubble message={messageWithTime} />);
    
    expect(screen.getByText('14:30')).toBeInTheDocument();
  });

  it('should handle empty metadata gracefully', () => {
    const messageWithEmptyMetadata: Message = {
      ...baseMessage,
      metadata: {}
    };
    
    render(<MessageBubble message={messageWithEmptyMetadata} />);
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    expect(screen.queryByText('Transaction Details:')).not.toBeInTheDocument();
  });

  it('should preserve line breaks in message content', () => {
    const multilineMessage: Message = {
      ...baseMessage,
      content: 'Line 1\nLine 2\nLine 3'
    };
    
    render(<MessageBubble message={multilineMessage} />);
    
    const content = screen.getByText('Line 1\nLine 2\nLine 3');
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass('whitespace-pre-wrap');
  });
});