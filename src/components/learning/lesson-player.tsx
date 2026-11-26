'use client';
import { useRef } from 'react';
import { ActionForm } from './action-form';
export function LessonPlayer({
  url,
  position,
  captions,
}: {
  url: string;
  captions: string | null;
  position: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <>
      <video
        ref={ref}
        className="learn-video"
        controls
        crossOrigin="anonymous"
        preload="metadata"
        onLoadedMetadata={() => {
          if (ref.current) ref.current.currentTime = position;
        }}
      >
        <source src={url} />
        {captions && (
          <track
            kind="captions"
            src={captions}
            srcLang="en"
            label="English captions"
            default
          />
        )}
        Your browser cannot play this video. Use the resource link below.
      </video>
      <p className="learn-meta">
        Resume position: {position} seconds. Save your position using the lesson
        controls below.
      </p>
      <a href={url} rel="noopener noreferrer" target="_blank">
        Open video resource
      </a>
    </>
  );
}
export function LessonControls({
  enrollmentId,
  lessonId,
  position,
  duration,
  completed,
}: {
  enrollmentId: string;
  lessonId: string;
  position: number;
  duration: number;
  completed: boolean;
}) {
  return (
    <ActionForm
      action="progress"
      values={{ enrollmentId, lessonId }}
      fields={[
        {
          name: 'positionSeconds',
          label: 'Resume position in seconds',
          type: 'number',
          value: position,
          min: 0,
          max: duration,
          required: true,
        },
        {
          name: 'complete',
          label: completed
            ? 'Lesson completed (completion is retained)'
            : 'I have completed this lesson',
          type: 'checkbox',
          value: completed,
        },
      ]}
      button="Save learning progress"
      success="Learning progress saved."
    />
  );
}
