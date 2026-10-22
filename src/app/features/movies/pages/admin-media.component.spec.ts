import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { UploadManager } from '../../../core/uploads/upload-manager.service';
import { UploadRecord } from '../../../core/uploads/upload.model';
import { ContentStore } from '../state/content.store';
import { AdminMediaComponent } from './admin-media.component';

describe('Studio background uploads', () => {
  it('updates the correct movie even when another movie is selected', () => {
    const completed = new Subject<UploadRecord>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ContentStore, useValue: { refresh: () => {} } },
        { provide: UploadManager, useValue: { completed$: completed.asObservable() } },
      ],
    });
    const fixture = TestBed.createComponent(AdminMediaComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/content/admin/limit/50/offset/0').flush({
      items: [
        { id: 'first', title: 'First' },
        { id: 'second', title: 'Second' },
      ],
      meta: { totalItem: 2 },
    });
    fixture.componentInstance.selected.set(fixture.componentInstance.movies()[0]);
    completed.next({
      key: 'second-video',
      owner: 'admin',
      purpose: 'video',
      contentId: 'second',
      name: 'movie.mp4',
      modified: 1,
      size: 24,
      status: 'complete',
      progress: 100,
      result: {
        objectKey: 'admin/video.mp4',
        bucket: 'public',
        fileName: 'movie.mp4',
        mimeType: 'video/mp4',
        size: 24,
      },
    });
    expect(fixture.componentInstance.movies()[1].videoObjectKey).toBe('admin/video.mp4');
    expect(fixture.componentInstance.selected()?.id).toBe('first');
    expect(fixture.componentInstance.movies()[0].videoObjectKey).toBeUndefined();
    http.verify();
  });
});

describe('Studio movie editor', () => {
  function setup() {
    const refresh = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ContentStore, useValue: { refresh } },
        { provide: UploadManager, useValue: { completed$: new Subject<UploadRecord>() } },
      ],
    });
    const fixture = TestBed.createComponent(AdminMediaComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    return { component, http, refresh };
  }
  it('selects the server-created draft before allowing media uploads', () => {
    const { component, http, refresh } = setup();
    component.startNew();
    component.draft.title = '  Arrival  ';
    component.save();
    const request = http.expectOne('/api/content');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.title).toBe('Arrival');
    expect(request.request.body.status).toBeUndefined();
    request.flush({ id: 'created', title: 'Arrival', type: 'MOVIE', status: 'DRAFT' });
    expect(component.selected()?.id).toBe('created');
    expect(component.creating()).toBe(false);
    expect(component.canPublish()).toBe(false);
    expect(refresh).toHaveBeenCalledOnce();
    http.verify();
  });
  it('keeps failed edits and sends explicit clearing without overwriting media or status', () => {
    const { component, http } = setup();
    component.selected.set({
      id: 'existing',
      title: 'Old',
      type: 'MOVIE',
      status: 'PUBLISHED',
      createdAt: '',
      updatedAt: '',
      posterObjectKey: 'poster',
      videoObjectKey: 'video',
    });
    component.draft.title = 'Updated';
    component.dirty.set(true);
    component.save();
    const request = http.expectOne('/api/content/existing');
    expect(request.request.body.clearReleaseDate).toBe(true);
    expect(request.request.body.clearDurationSeconds).toBe(true);
    expect(request.request.body.posterObjectKey).toBeUndefined();
    expect(request.request.body.videoObjectKey).toBeUndefined();
    expect(request.request.body.status).toBeUndefined();
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(component.draft.title).toBe('Updated');
    expect(component.dirty()).toBe(true);
    expect(component.busy()).toBe(false);
    expect(component.selected()?.videoObjectKey).toBe('video');
    http.verify();
  });
});
