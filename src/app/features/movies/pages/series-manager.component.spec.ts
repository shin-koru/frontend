import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { UploadManager } from '../../../core/uploads/upload-manager.service';
import { UploadRecord } from '../../../core/uploads/upload.model';
import { SeriesManagerComponent } from './series-manager.component';
describe('Series management', () => {
  function setup() {
    const completed = new Subject<UploadRecord>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UploadManager, useValue: { completed$: completed } },
      ],
    });
    const fixture = TestBed.createComponent(SeriesManagerComponent);
    fixture.componentRef.setInput('contentId', 'series');
    return {
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
      completed,
    };
  }
  it('ignores stale episode responses after switching seasons', () => {
    const { component, http } = setup();
    component.seasons.set([
      { id: 'one', contentId: 'series', seasonNumber: 1, status: 'DRAFT' },
      { id: 'two', contentId: 'series', seasonNumber: 2, status: 'DRAFT' },
    ]);
    component.chooseSeason({ target: { value: 'one' } } as unknown as Event);
    const first = http.expectOne('/api/season/admin/one/episode');
    component.chooseSeason({ target: { value: 'two' } } as unknown as Event);
    http.expectOne('/api/season/admin/two/episode').flush({ episodes: [{ id: 'second' }] });
    first.flush({ episodes: [{ id: 'first' }] });
    expect(component.episodes()[0].id).toBe('second');
    http.verify();
  });
  it('retains failed edits and excludes publication status and media from details writes', () => {
    const { component, http } = setup();
    component.season.set({
      id: 'season',
      contentId: 'series',
      seasonNumber: 1,
      status: 'PUBLISHED',
    });
    component.episode.set({
      id: 'episode',
      seasonId: 'season',
      episodeNumber: 1,
      title: 'Original',
      status: 'PUBLISHED',
      videoKey: 'saved-video',
    });
    component.episodeDraft = {
      episodeNumber: 2,
      title: 'Edited',
      description: '',
      releaseDate: '',
      durationSeconds: '',
    };
    component.episodeDirty.set(true);
    component.saveEpisode();
    const request = http.expectOne('/api/episode/episode');
    expect(request.request.body.clearReleaseDate).toBe(true);
    expect(request.request.body.clearDurationSeconds).toBe(true);
    expect(request.request.body.videoKey).toBeUndefined();
    expect(request.request.body.status).toBeUndefined();
    request.flush({}, { status: 409, statusText: 'Conflict' });
    expect(component.episodeDirty()).toBe(true);
    expect(component.episodeDraft.title).toBe('Edited');
    expect(component.episode()?.videoKey).toBe('saved-video');
    expect(component.error()).toContain('number is already used');
    http.verify();
  });
  it('applies background video completion without resetting another episode editor', () => {
    const { component, completed } = setup();
    component.episodes.set([
      { id: 'one', seasonId: 'season', episodeNumber: 1, title: 'First', status: 'DRAFT' },
      { id: 'two', seasonId: 'season', episodeNumber: 2, title: 'Second', status: 'DRAFT' },
    ]);
    component.episode.set(component.episodes()[0]);
    component.episodeDraft.title = 'Unsaved';
    component.episodeDirty.set(true);
    completed.next({ episodeId: 'two', result: { objectKey: 'video' } } as UploadRecord);
    expect(component.episodes()[1].videoKey).toBe('video');
    expect(component.episode()?.id).toBe('one');
    expect(component.episodeDraft.title).toBe('Unsaved');
    expect(component.episodeDirty()).toBe(true);
  });
});
