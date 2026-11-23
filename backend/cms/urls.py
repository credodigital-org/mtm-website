from django.urls import path, re_path

from . import views

urlpatterns = [
    # public
    path("content/", views.PublicContentView.as_view(), name="public-content"),
    path("enquiries/", views.EnquiryCreateView.as_view(), name="enquiry-create"),
    # admin (staff JWT)
    path("admin/stats/", views.StatsView.as_view(), name="admin-stats"),
    path("admin/content/", views.AdminContentView.as_view(), name="admin-content"),
    re_path(r"^admin/content/(?P<section>[A-Z_]+)/$", views.AdminContentSectionView.as_view(), name="admin-content-section"),
    path("admin/enquiries/", views.EnquiryListView.as_view(), name="admin-enquiries"),
    path("admin/enquiries/export/", views.EnquiryExportView.as_view(), name="admin-enquiries-export"),
    path("admin/enquiries/<int:pk>/", views.EnquiryDetailView.as_view(), name="admin-enquiry"),
    path("admin/media/", views.MediaListView.as_view(), name="admin-media"),
    path("admin/media/<int:pk>/", views.MediaDetailView.as_view(), name="admin-media-item"),
    path("admin/users/", views.UserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", views.UserDetailView.as_view(), name="admin-user"),
    path("admin/password/", views.PasswordView.as_view(), name="admin-password"),
]
