import ActivityLog from '../models/ActivityLog.js';

export const logActivity = async ({ schoolId, user, userRole, action, entity, details }) => {
  try {
    await ActivityLog.create({
      school: schoolId,
      user: user || 'System',
      userRole: userRole || 'system',
      action,
      entity,
      details,
    });
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
};

export default logActivity;
