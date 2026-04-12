/**
 * Issue Wizard Component - React Integration Example
 * 
 * This component demonstrates how to integrate the conversational issue creation
 * endpoint into a React application using a step-by-step question flow.
 */

import React, { useState, useEffect } from 'react';

const IssueWizard = ({ token, onSuccess, onCancel }) => {
  const [sessionId, setSessionId] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [question, setQuestion] = useState('');
  const [hint, setHint] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [options, setOptions] = useState([]);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  // Initialize the wizard on mount
  useEffect(() => {
    initializeWizard();
  }, []);

  const initializeWizard = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetch('http://localhost:3000/issue-wizard', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!result.ok) {
        throw new Error(`Failed to initialize wizard: ${result.statusText}`);
      }

      const data = await result.json();
      setSessionId(data.sessionId);
      setCurrentStep(data.step);
      setQuestion(data.question);
      setHint(data.hint || '');
      setPlaceholder(data.placeholder || '');
      setOptions(data.options || []);
      setResponse('');
      setHistory([{ step: data.step, question: data.question, type: 'question' }]);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (value) => {
    setResponse(value);
    setLoading(true);
    setError(null);

    try {
      const result = await fetch('http://localhost:3000/issue-wizard', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionId,
          response: value
        })
      });

      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(errorData.error || `Error: ${result.statusText}`);
      }

      const data = await result.json();

      // Add to history
      setHistory(prev => [
        ...prev,
        { step: currentStep, response: value, type: 'response' },
        { step: data.step, question: data.question, type: 'question', options: data.options }
      ]);

      setCurrentStep(data.step);
      setQuestion(data.question);
      setHint(data.hint || '');
      setPlaceholder(data.placeholder || '');
      setOptions(data.options || []);
      setSummary(data.summary || null);
      setResponse('');

      // Check if wizard is complete
      if (data.success) {
        onSuccess(data);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Send cancel response to clean up server session
    if (sessionId) {
      try {
        await fetch('http://localhost:3000/issue-wizard', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: sessionId,
            response: 'cancel'
          })
        });
      } catch (err) {
        console.error('Error cancelling wizard:', err);
      }
    }
    onCancel();
  };

  // Render confirmation screen differently
  if (currentStep === 'confirm' && summary) {
    return (
      <div className="issue-wizard">
        <div className="wizard-header">
          <h2>Review Your Issue</h2>
        </div>

        <div className="wizard-content">
          <div className="summary-box">
            <div className="summary-item">
              <strong>Summary:</strong> {summary.summary}
            </div>
            <div className="summary-item">
              <strong>Priority:</strong> {summary.priority}
            </div>
            <div className="summary-item">
              <strong>Type:</strong> {summary.issueType}
            </div>
            <div className="summary-item">
              <strong>Assignee:</strong> {summary.assignee}
            </div>
            <div className="summary-item">
              <strong>Description:</strong> {summary.description ? summary.description : '(none)'}
            </div>
          </div>

          <div className="question-box">
            <p className="question-text">{question}</p>

            {error && <div className="error-message">{error}</div>}

            <div className="button-group">
              <button
                onClick={() => handleResponse('yes')}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : '✓ Create Issue'}
              </button>
              <button
                onClick={() => handleResponse('no')}
                disabled={loading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render options-based screen (priority, type)
  if (options && options.length > 0) {
    return (
      <div className="issue-wizard">
        <div className="wizard-header">
          <h2>Create Issue</h2>
          <p className="step-indicator">Step {getStepNumber(currentStep)} of 6</p>
        </div>

        <div className="wizard-content">
          <div className="question-box">
            <p className="question-text">{question}</p>
            {hint && <p className="hint">{hint}</p>}

            {error && <div className="error-message">{error}</div>}

            <div className="options-group">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleResponse(option)}
                  disabled={loading}
                  className="btn btn-option"
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              onClick={handleCancel}
              disabled={loading}
              className="btn btn-cancel"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="wizard-history">
          <h4>Progress</h4>
          <div className="history-list">
            {history.map((item, idx) => (
              <div key={idx} className={`history-item ${item.type}`}>
                {item.type === 'question' && (
                  <div className="history-question">Q: {item.question}</div>
                )}
                {item.type === 'response' && (
                  <div className="history-response">A: {item.response}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render text input screen
  return (
    <div className="issue-wizard">
      <div className="wizard-header">
        <h2>Create Issue</h2>
        <p className="step-indicator">Step {getStepNumber(currentStep)} of 6</p>
      </div>

      <div className="wizard-content">
        <div className="question-box">
          <p className="question-text">{question}</p>
          {hint && <p className="hint">{hint}</p>}

          {error && <div className="error-message">{error}</div>}

          <input
            type="text"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && response.trim() && !loading) {
                handleResponse(response);
              }
            }}
            placeholder={placeholder}
            disabled={loading}
            className="input-text"
            autoFocus
          />

          <div className="button-group">
            <button
              onClick={() => handleResponse(response)}
              disabled={loading || !response.trim()}
              className="btn btn-primary"
            >
              {loading ? 'Processing...' : 'Next'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="wizard-history">
        <h4>Progress</h4>
        <div className="history-list">
          {history.map((item, idx) => (
            <div key={idx} className={`history-item ${item.type}`}>
              {item.type === 'question' && (
                <div className="history-question">Q: {item.question}</div>
              )}
              {item.type === 'response' && (
                <div className="history-response">A: {item.response}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to get step number
const getStepNumber = (step) => {
  const steps = {
    'summary': 1,
    'priority': 2,
    'assignee': 3,
    'issueType': 4,
    'description': 5,
    'confirm': 6
  };
  return steps[step] || 0;
};

// CSS Styles (place in your CSS file)
const styles = `
.issue-wizard {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.wizard-header {
  margin-bottom: 20px;
  border-bottom: 2px solid #007bff;
  padding-bottom: 10px;
}

.wizard-header h2 {
  margin: 0 0 5px 0;
  color: #333;
}

.step-indicator {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.wizard-content {
  margin-bottom: 20px;
}

.question-box {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.question-text {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin: 0 0 10px 0;
}

.hint {
  color: #666;
  font-size: 13px;
  margin: 5px 0 15px 0;
  font-style: italic;
}

.input-text {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 15px;
  box-sizing: border-box;
}

.input-text:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.options-group {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 15px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-option {
  background: white;
  color: #007bff;
  border: 2px solid #007bff;
  padding: 12px 20px;
  text-align: left;
  font-weight: 500;
}

.btn-option:hover:not(:disabled) {
  background: #007bff;
  color: white;
}

.btn-secondary, .btn-cancel {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled), .btn-cancel:hover:not(:disabled) {
  background: #5a6268;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 10px;
}

.button-group .btn {
  flex: 1;
}

.summary-box {
  background: #e7f3ff;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #b3d9ff;
}

.summary-item {
  margin: 8px 0;
  color: #333;
}

.summary-item strong {
  color: #007bff;
  min-width: 100px;
  display: inline-block;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #f5c6cb;
}

.wizard-history {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
  margin-top: 20px;
}

.wizard-history h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
}

.history-item {
  margin: 8px 0;
  padding: 8px;
  border-radius: 3px;
  font-size: 13px;
}

.history-question {
  background: #e7f3ff;
  color: #0056b3;
  padding: 8px;
  border-left: 3px solid #007bff;
}

.history-response {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 8px;
  border-left: 3px solid #4caf50;
}
`;

export default IssueWizard;
