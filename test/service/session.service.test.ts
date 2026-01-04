import { sessionService } from '../../src/services/session.service';
import { CleanSnapshot, FrameEventTypes } from '../../src/core/machine.types';
import { Snapshot } from 'xstate';
import { frameMachine } from '../../src/core/frame.machine';

// Define the type for the internal snapshot to ensure our mocks are correct.
type FrameMachineSnapshot = Snapshot<typeof frameMachine>;

// Before each test, clear all active sessions to ensure a clean, isolated state
// and prevent tests from interfering with each other.
beforeEach(() => {
  // Accessing a private property for testing purposes is a common practice
  // to reset state between tests. This should not be done in production code.
  (sessionService as any).activeSessions.clear();
  // Clear any mocks to ensure they don't leak between tests.
  jest.clearAllMocks();
});

// --------------------------------------------------------------
// Unit Tests for SessionService - Input Validation and Edge Cases
// --------------------------------------------------------------
describe('SessionService - Input Validation and Edge Cases', () => {

  // Test suite for the private cleanSnapshot method.
  describe('cleanSnapshot', () => {
    // A realistic mock of an ACTIVE, internal XState snapshot.
    const MOCK_INTERNAL_XSTATE_SNAPSHOT = {
      value: 'someState',
      context: { aktuellerFrame: 'someFrame' },
    } as unknown as FrameMachineSnapshot;

    // Test: verifies that a null or undefined snapshot is rejected.
    it('should throw an error if snapshot is null or undefined', () => {
      const privateCleanSnapshot = (sessionService as any).cleanSnapshot;
      expect(() => privateCleanSnapshot(null, 'any-id')).toThrow('Invalid snapshot');
    });

    // Test: verifies that invalid session IDs are rejected.
    it('should throw an error if sessionId is invalid', () => {
      const privateCleanSnapshot = (sessionService as any).cleanSnapshot;
      expect(() => privateCleanSnapshot(MOCK_INTERNAL_XSTATE_SNAPSHOT, '')).toThrow('Invalid Session-ID');
      expect(() => privateCleanSnapshot(MOCK_INTERNAL_XSTATE_SNAPSHOT, '   ')).toThrow('Invalid Session-ID');
    });
  });

  // Test: ensures `createSession` rejects invalid session IDs.
  it('should throw an error when creating a session with an invalid ID', () => {
    expect(() => sessionService.createSession('')).toThrow('Invalid Session-ID');
    expect(() => sessionService.createSession('   ')).toThrow('Invalid Session-ID');
  });

  // Test: covers the "not found" branch in `removeSession`.
  it('should return false when trying to remove a non-existent session', () => {
    const result = sessionService.removeSession('non-existent-id');
    expect(result).toBe(false);
  });

  // Test: ensures `removeSession` rejects invalid session IDs.
  it('should throw an error from removeSession if sessionId is invalid', () => {
    // This test specifically targets the validation inside removeSession,
    // not a potential error thrown by a mocked getSession.
    expect(() => sessionService.removeSession('')).toThrow('Invalid Session-ID');
    expect(() => sessionService.removeSession('   ')).toThrow('Invalid Session-ID');
  });

  // Test: ensures `getSession` rejects invalid session IDs.
  it('should throw an error when getting a session with an invalid ID', () => {
    expect(() => sessionService.getSession('')).toThrow('Invalid Session-ID');
  });

  // Test suite for the input validation of the `sendEvent` method.
  describe('sendEvent validation', () => {
    // Test: verifies rejection of various invalid inputs.
    it('should throw an error for invalid event objects or session IDs', () => {
      sessionService.createSession('test-session');
      expect(() => sessionService.sendEvent('', { type: FrameEventTypes.NAECHSTER_FRAME })).toThrow('Invalid input');
      expect(() => sessionService.sendEvent('test-session', {} as any)).toThrow('Invalid input');
      expect(() => sessionService.sendEvent('test-session', { type: 'INVALID_EVENT_TYPE' } as any)).toThrow('Invalid input');
    });

    // Test: covers the "not found" scenario.
    it('should throw an error when sending an event to a non-existent session', () => {
      expect(() => sessionService.sendEvent('non-existent-id', { type: FrameEventTypes.NAECHSTER_FRAME })).toThrow("Session with ID 'non-existent-id' not found.");
    });
  });

  // Test: ensures `getSessionState` rejects invalid session IDs.
  it('should throw an error when getting state with an invalid session ID', () => {
    expect(() => sessionService.getSessionState('')).toThrow('Invalid Session-ID');
  });
  
  // Test: covers the "happy path" for `getAllSessions`
  // where the session map is not empty, ensuring the loop is executed.
  it('should return an array of snapshots when sessions are active', () => {
    sessionService.createSession('session-1');
    sessionService.createSession('session-2');
    
    const sessions = sessionService.getAllSessions();
    
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe('session-1');
    expect(sessions[1].sessionId).toBe('session-2');
  });

  // Test: This test is somewhat artificial,
  // designed to cover defensive code blocks that are hard to reach in normal execution.
  // It simulates a race condition where a session might be deleted between two internal checks.
  it('should handle a race condition where a session disappears between checks', () => {
    const sessionId = 'race-condition-session';
    
    // 1. Create a real session so the first check passes.
    sessionService.createSession(sessionId);

    // 2. Spy on `getSession` to alter its behavior mid-flight.
    // We make the first call succeed, but all subsequent calls fail (return undefined).
    const getSessionSpy = jest.spyOn(sessionService, 'getSession')
      .mockImplementationOnce(() => sessionService.getSession(sessionId)) 
      .mockReturnValue(undefined); // All subsequent calls return undefined
      
    // 3. Test `sendEvent` 
    // The first internal `getSession` passes.
    // The second internal `getSession` is mocked to fail, triggering the defensive check.
    expect(() => sessionService.sendEvent(sessionId, { type: FrameEventTypes.NAECHSTER_FRAME })).toThrow(`Session with ID '${sessionId}' not found.`);

    // 4. Restore the original `getSession` method to not affect other tests.
    getSessionSpy.mockRestore();

    // 5. Repeat the process for `getSessionState`
    sessionService.createSession(sessionId); // Re-create the session
    
    const getSessionSpy2 = jest.spyOn(sessionService, 'getSession')
      .mockImplementationOnce(() => sessionService.getSession(sessionId)) // First call ok
      .mockReturnValue(undefined); // Second call fails
      
    // 6. Test `getSessionState`
    expect(() => sessionService.getSessionState(sessionId)).toThrow(`Session with ID '${sessionId}' not found.`);
    
    getSessionSpy2.mockRestore();
  });
});