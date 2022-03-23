import React, { Fragment, FC, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from '@emotion/core';
import useSWR, { cache, useSWRInfinite } from 'swr';
import Link from 'next/link';
import { Button } from '@chakra-ui/react';

import { EventSession as EventSessionModel } from '../../../state/models/EventSession';
import { FontFamily } from '../../../enums';
import { Markdown } from '../../Markdown';
import { H3 } from '../../core/Heading';
import { useStores } from '../../../hooks/useStores';
import { useQueryParams } from '../../../hooks/useQueryParams';
import { StringParam } from '../../../utils/url-query-string';
import {
  FETCH_EVENT_SESSION_LECTURES_KEY,
  fetchEventSessionLectures,
} from '../../../fetchers/lectures';
import { extractSWRInfiniteData } from '../../../utils/swr';
import { Lecture } from '../../../state/models/Lecture';
import {
  FETCH_LECTURE_STATUSES_KEY,
  fetchLectureStatuses,
} from '../../../fetchers/lecture-statuses';
import { isEnabled } from '../../../utils/models/lecture';
import { LectureSpeakers } from '../LectureSpeakers';
import { Skeleton, SkeletonText } from '../../core/Skeleton/Skeleton';
import { FilledButton } from '../../core/Button/variants/FilledButton';

const styledTitleCss = css`
  margin: 35px 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const StyledMarkdown = styled(Markdown)`
  margin: 0 0 24px;
  font-size: 16px;
  line-height: 24px;
  font-family: ${FontFamily.IBMPlexSans};
`;

interface IEventSessionProps {
  eventSession: EventSessionModel;
  scope: 'lectures' | 'posters';
  displayAll?: boolean;
}

const ItemsContainer = styled.div<{ isPoster: boolean }>`
  display: grid;
  padding-bottom: 16px;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(${({ isPoster }) => (isPoster ? '350px' : '290px')}, 100%), 1fr)
  );
  grid-gap: 40px;
`;

const PAGE_SIZE = '8';

export const EventSession: FC<IEventSessionProps> = ({
  eventSession,
  scope,
  displayAll = false,
}) => {
  const { t } = useTranslation();
  const { store } = useStores();
  const { eventId } = useQueryParams({
    eventId: StringParam,
  });

  const isPoster = scope === 'posters';

  // hotfix for swr cache clear on page transition
  // looks like swr bug since persistPage option doesn't work
  // we should report the bug and fix it on lib level
  useEffect(() => {
    return () => {
      cache.clear();
    };
  }, []);

  const { data, error, size, setSize } = useSWRInfinite(
    (index) => [index + 1, FETCH_EVENT_SESSION_LECTURES_KEY, eventSession.id, isPoster, displayAll],
    (pageIndex) =>
      fetchEventSessionLectures(store, eventSession.id, isPoster, PAGE_SIZE, pageIndex),
    {
      initialSize: displayAll ? 2 : 1,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const { isLoadingMore, isReachingEnd, isEmpty, items } = useMemo(
    () => extractSWRInfiniteData<Lecture>(data, error, size),
    [data, error, size],
  );

  // eslint-disable-next-line no-unused-vars
  const { data: _ } = useSWR(
    () => (items.length > 0 ? [FETCH_LECTURE_STATUSES_KEY, ...items] : null),
    () => fetchLectureStatuses(store, items),
  );

  const onLoadMore = () => {
    setSize(size + 1);
  };

  return (
    <Fragment key={`fragment-${eventSession.id}`}>
      <div css={styledTitleCss}>
        <H3 key={`session-name-${eventSession.id}`}>{eventSession.name}</H3>

        {!isLoadingMore && !isReachingEnd && !isEmpty && !displayAll && (
          <div css={{ marginLeft: '10px' }}>
            <Link href={viewAllHref} as={viewAllAs} passHref>
              <Button as="a" variant="link" fontSize="sm" textTransform="uppercase">
                {t('common.seeAll')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {eventSession.description && <StyledMarkdown source={eventSession.description} />}

      {!isEmpty && (
        <ItemsContainer isPoster={isPoster} key={`lectures-container-${eventSession.id}`}>
          {items.map((lecture) => (
            <LectureLink
              key={lecture.id}
              eventId={eventId}
              sessionId={eventSession.id}
              linkSlug={lecture.linkSlug}
              disabled={!isEnabled(lecture)}
              isPoster={Boolean(lecture.posterDocument)}
            >
              <LectureCard
                title={lecture.title}
                publishedAt={lecture.publishedAt}
                posterUrl={
                  isPoster ? lecture.mediumPosterDocumentThumbnailUrl : lecture.mediumPosterUrl
                }
                isPoster={isPoster}
                isLive={lecture.streamActive}
              >
                <LectureSpeakers speakers={lecture.profiles} />
              </LectureCard>
            </LectureLink>
          ))}

          {isLoadingMore &&
            Array.from({ length: parseInt(PAGE_SIZE, 10) }, (__, index) => (
              <div key={index} css={{ height: 290, width: '100%' }}>
                <Skeleton css={{ width: '100%', height: 160, marginBottom: 25 }} />
                <SkeletonText noOfLines={3} css={{ width: '100%', padding: 15 }} />
              </div>
            ))}
        </ItemsContainer>
      )}
      {!isReachingEnd && displayAll && (
        <div css={{ textAlign: 'center', paddingTop: 10 }}>
          <FilledButton
            css={{ padding: '10px 16px', marginBottom: 20 }}
            disabled={isLoadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {t('eventSessionsList.loadMore')}
          </FilledButton>
        </div>
      )}
    </Fragment>
  );
};


------------------------------------



import { NextPage, NextPageContext } from 'next';
import React, { Fragment } from 'react';
import { NextSeo } from 'next-seo';
import getConfig from 'next/config';

import { Layout } from '@layouts/Layout';
import { Subject } from '@resources/Subject';
import { ThinLecture } from '@resources/ThinLecture';
import { Profile } from '@resources/Profile';
import { useStores } from '@hooks/useStores';
import { fetchRootSubjects } from '../fetchers/subjects';
import { fetchLibraryLandingLectures } from '../fetchers/thin-lectures';
import { fetchLibraryLandingProfile } from '../fetchers/profiles';
import { AppCollection as AppStore } from '../state/AppStore';

const { publicRuntimeConfig } = getConfig();

interface INextPageProps {
  subjectIds?: Array<string>;
  lectureIds?: Array<string>;
  profileIds?: Array<string>;
}

const LibraryPage: NextPage<INextPageProps> = ({ subjectIds, lectureIds, profileIds }) => {
  const { store } = useStores();

  const subjects = store.findByIds(Subject, subjectIds);
  const lectures = store.findByIds(ThinLecture, lectureIds);
  const profiles = store.findByIds(Profile, profileIds);

  return (
    <Fragment>
      <NextSeo
        title="Library"
        openGraph={{
          url: `${publicRuntimeConfig.baseUrl}library-landing`,
          images: [
            {
              url: `${publicRuntimeConfig.baseUrl}images/library/landing-hero-share.jpg`,
              width: 818,
              height: 520,
              alt: 'Underline.io',
            },
          ],
        }}
      />
      <Layout navigationFontColor="white">
        <LibraryLandingHeading subjects={subjects} />
        <LibraryLandingLectures lectures={lectures} />
        <LibraryLandingProfiles profiles={profiles} />
        <LibraryLandingTopEvents />
        <LibraryLandingFeatures />
        <LibraryLandingBanner />
      </Layout>
    </Fragment>
  );
};

interface IContext extends NextPageContext {
  store: AppStore;
}

LibraryPage.getInitialProps = async (ctx: IContext) => {
  try {
    const [subjectsRequest, lecturesRequest, profilesRequest] = await Promise.all([
      fetchRootSubjects(ctx.store, 4),
      fetchLibraryLandingLectures(ctx.store),
      fetchLibraryLandingProfile(ctx.store),
    ]);

    const subjects = subjectsRequest?.data as Array<Subject>;
    const lectures = lecturesRequest?.data as Array<ThinLecture>;
    const profiles = profilesRequest?.data as Array<Profile>;

    return {
      subjectIds: subjects?.map((subject) => subject.id),
      lectureIds: lectures?.map((lecture) => lecture.id),
      profileIds: profiles?.map((profile) => profile.id),
    };
  } catch (responseWithError) {
    throw responseWithError.error;
  }
};

export default LibraryPage;
