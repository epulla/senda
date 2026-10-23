# Moodle

Connect to Moodle to find courses and deadlines, view course settings, and rename courses.

## Tools

- `my_courses`, `upcoming_deadlines`, `search_courses`: read course and deadline information.
- `get_course`: read a course's full and short names from its settings page.
- `rename_course`: change those names. Senda asks for approval every time before making the change.

## Install

Choose **Add site** in the Senda side panel, or ask your AI to call `adapter_install` with template `moodle`, your site URL, and a short label.

## Limitations

Needs a logged-in Moodle session. Tested on Moodle 5.1. `get_course` and `rename_course` read the course settings page, so they need edit rights.

## Manual test

TODO: Test on a Moodle site.
