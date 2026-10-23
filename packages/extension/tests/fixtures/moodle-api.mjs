export function handleMoodle(body, cookie, sesskey) {
  if (!cookie?.includes('MoodleSession=fixture') || sesskey !== 'fixSESS123')
    return [{ error: true, exception: { errorcode: 'invalidsesskey' } }];
  return body.map((x) => ({
    error: false,
    data:
      x.methodname === 'core_calendar_get_action_events_by_timesort'
        ? {
            events: [
              {
                id: 1,
                name: 'Fixture deadline',
                timesort: 1900000000,
                course: { fullname: 'Fixture course' },
                url: '/moodle/mod/assign/view.php?id=1',
              },
            ],
          }
        : { courses: [{ id: 1, fullname: 'Fixture course', viewurl: '/moodle/course/view.php?id=1' }] },
  }));
}
